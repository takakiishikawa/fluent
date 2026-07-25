"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import { revalidatePath } from "next/cache";
import { extractYoutubeVideoId } from "@/lib/youtube";
import type { Song, SongLine } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SONG_TRANSLATE_SYSTEM_PROMPT = `You translate English song lyrics into natural, singable Japanese for a language learner.

Rules:
- Translate EACH line independently but keep the overall song's meaning/tone consistent across lines.
- Natural, idiomatic Japanese — not a stiff word-for-word translation.
- No furigana, no explanations, no romanization. Japanese text only per line.
- Preserve line order exactly; return exactly one translation per input line.

Return ONLY via the tool.`;

const SONG_TRANSLATE_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    translations: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Japanese translation for each input line, in the same order.",
    },
  },
  required: ["translations"],
};

async function translateLinesToJapanese(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];

  const userMessage = `Lyrics lines (translate each one):\n${texts
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n")}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: SONG_TRANSLATE_SYSTEM_PROMPT,
    tools: [
      {
        name: "save_translations",
        description: "Save the Japanese translation for each lyrics line.",
        input_schema: SONG_TRANSLATE_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "save_translations" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI response did not include tool_use");
  }
  const { translations } = toolUse.input as { translations: string[] };
  return texts.map((_, i) => translations[i] ?? "");
}

export async function listSongs(): Promise<Song[]> {
  const supabase = await createClient();
  const language = await getCurrentLanguage();
  const { data } = await supabase
    .from("songs")
    .select("*")
    .eq("language", language)
    .order("created_at", { ascending: false });
  return (data ?? []) as Song[];
}

// YouTube oEmbed（キー不要の公開エンドポイント）で動画タイトル/チャンネル名を取得する
export async function fetchYoutubeMeta(
  videoUrl: string,
): Promise<{ title: string; artist: string } | null> {
  const videoId = extractYoutubeVideoId(videoUrl);
  if (!videoId) return null;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`,
    )}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string };
    return { title: data.title ?? "", artist: data.author_name ?? "" };
  } catch (err) {
    console.error("[fetchYoutubeMeta] failed:", err);
    return null;
  }
}

// 歌詞テキストを練習単位の行に分割する。改行はそのまま行として尊重しつつ、
// 改行のない長い塊（貼り付け元によっては1段落になっていることがある）は
// 文の区切り（.!?）でさらに分割する。ユーザーに手動で1行ずつ整形させない。
function splitLyricsIntoLines(raw: string): SongLine[] {
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  const texts: string[] = [];
  for (const rawLine of normalized.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const sentences = line.match(/[^.!?]+[.!?]*(?:\s+|$)/g);
    if (sentences && sentences.length > 1) {
      for (const s of sentences) {
        const t = s.trim();
        if (t) texts.push(t);
      }
    } else {
      texts.push(line);
    }
  }
  return texts.map((text) => ({ text, translation: "", hint: "" }));
}

export async function createSong(input: {
  title: string;
  artist: string;
  videoUrl: string;
  lyrics: string;
}): Promise<{ error?: string; song?: Song }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const videoId = extractYoutubeVideoId(input.videoUrl);
  if (!videoId) {
    return { error: "Enter a valid YouTube video URL" };
  }

  const lines = splitLyricsIntoLines(input.lyrics);
  if (lines.length === 0) {
    return { error: "Paste the song's lyrics" };
  }

  // 追加時にAIで全行を日本語訳し、DBに保存しておく（再生画面ではDBから読むだけにする）
  try {
    const translations = await translateLinesToJapanese(
      lines.map((l) => l.text),
    );
    lines.forEach((l, i) => {
      l.hint = translations[i] ?? "";
    });
  } catch (err) {
    console.error("[createSong] translation failed:", err);
  }

  // タイトル未入力（oEmbed取得に失敗した等）ならサーバー側でも一度フォールバック取得を試みる
  let title = input.title.trim();
  let artist = input.artist.trim();
  if (!title) {
    const meta = await fetchYoutubeMeta(input.videoUrl);
    title = meta?.title || "Untitled song";
    if (!artist) artist = meta?.artist ?? "";
  }

  const language = await getCurrentLanguage();
  const { data, error } = await supabase
    .from("songs")
    .insert({
      user_id: user.id,
      language,
      title,
      artist,
      youtube_video_id: videoId,
      lines,
    })
    .select()
    .single();

  if (error) {
    console.error("[createSong] failed:", error.message);
    return { error: error.message };
  }
  revalidatePath("/songs");
  return { song: data as Song };
}

export async function updateSongLines(
  id: string,
  lines: SongLine[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("songs")
    .update({ lines, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/songs");
  return {};
}

export async function deleteSong(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("songs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/songs");
  return {};
}
