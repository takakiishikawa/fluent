"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import { revalidatePath } from "next/cache";
import { extractYoutubeVideoId } from "@/lib/youtube";
import type { Song, SongLine } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── 曲追加時: 公式和訳 + 語彙解説 + 文法解説をまとめて生成 ──

type LineAnalysis = {
  translation: string;
  vocabNotes: string;
  grammarNotes: string;
};

const SONG_ANALYZE_SYSTEM_PROMPT = `You analyze English song lyrics, line by line, for a Japanese learner who is translating the song themselves as a study exercise.

For EACH line, produce:
1. "translation": a natural, idiomatic Japanese translation of the line (not word-for-word).
2. "vocabNotes": a short Japanese note (~20-40字) on any notable vocabulary, idioms, phrasal verbs, or slang in the line. Empty string if nothing notable.
3. "grammarNotes": a short Japanese note (~20-40字) on any notable grammar point in the line (tense, structure, contraction, ellipsis, inversion, etc.). Empty string if nothing notable.

Rules:
- Keep the overall song's meaning/tone consistent across lines.
- Notes should help a learner understand WHY the line means what it means — not just restate the translation.
- Return exactly one entry per input line, in the same order.

Return ONLY via the tool.`;

const SONG_ANALYZE_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    lines: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          translation: { type: "string" as const },
          vocabNotes: { type: "string" as const },
          grammarNotes: { type: "string" as const },
        },
        required: ["translation", "vocabNotes", "grammarNotes"],
      },
    },
  },
  required: ["lines"],
};

async function analyzeSongLines(texts: string[]): Promise<LineAnalysis[]> {
  if (texts.length === 0) return [];

  const userMessage = `Lyrics lines (analyze each one):\n${texts
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n")}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: SONG_ANALYZE_SYSTEM_PROMPT,
    tools: [
      {
        name: "save_analysis",
        description:
          "Save the translation, vocab notes, and grammar notes for each lyrics line.",
        input_schema: SONG_ANALYZE_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "save_analysis" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI response did not include tool_use");
  }
  const { lines } = toolUse.input as { lines: LineAnalysis[] };
  return texts.map(
    (_, i) => lines[i] ?? { translation: "", vocabNotes: "", grammarNotes: "" },
  );
}

// ── レビュー時: 自分の訳と公式訳の違いについてのコメントを生成 ──

const DIFF_SYSTEM_PROMPT = `You compare a language learner's own Japanese translation of an English lyrics line against a natural reference translation, and give brief, specific feedback in Japanese on the difference.

For EACH line, given the ORIGINAL English text, the LEARNER's translation, and the REFERENCE translation, write a short comment (~30-60字) in Japanese:
- If the learner's translation captures the meaning well, say so briefly and note only minor nuance differences (if any).
- If there's a meaningful difference in meaning/nuance, explain what the reference conveys that the learner's version doesn't (or vice versa).
- Be constructive and specific — reference the actual words/nuance, not a generic "good job."
- Keep it short: one or two sentences.

Return exactly one comment per line, in the same order.

Return ONLY via the tool.`;

const DIFF_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    comments: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "One comparison comment per line, in the same order.",
    },
  },
  required: ["comments"],
};

async function compareTranslations(
  items: { text: string; own: string; reference: string }[],
): Promise<string[]> {
  if (items.length === 0) return [];

  const userMessage = items
    .map(
      (it, i) =>
        `${i + 1}.\nORIGINAL: ${it.text}\nLEARNER: ${it.own}\nREFERENCE: ${it.reference}`,
    )
    .join("\n\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: DIFF_SYSTEM_PROMPT,
    tools: [
      {
        name: "save_comments",
        description: "Save a comparison comment for each line.",
        input_schema: DIFF_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "save_comments" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI response did not include tool_use");
  }
  const { comments } = toolUse.input as { comments: string[] };
  return items.map((_, i) => comments[i] ?? "");
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
  return texts.map((text) => ({
    text,
    translation: "",
    hint: "",
    vocabNotes: "",
    grammarNotes: "",
    diffComment: "",
    reviewed: false,
  }));
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

  // 追加時にAIで全行分の公式和訳・語彙解説・文法解説をまとめて生成しDBに保存しておく
  // （レビューページでは保存済みのデータを読むだけにする）
  try {
    const analysis = await analyzeSongLines(lines.map((l) => l.text));
    lines.forEach((l, i) => {
      l.hint = analysis[i]?.translation ?? "";
      l.vocabNotes = analysis[i]?.vocabNotes ?? "";
      l.grammarNotes = analysis[i]?.grammarNotes ?? "";
    });
  } catch (err) {
    console.error("[createSong] analysis failed:", err);
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

// 公式和訳(hint)が空のまま残っている曲を後から埋める。
// 追加時の生成が未実装だった頃の曲や、一部だけ生成が失敗した曲を復旧するためのもの。
// hintが埋まっていない行は、語彙解説・文法解説もまとめて作り直す
export async function backfillSongAnalysis(
  id: string,
): Promise<{ error?: string; lines?: SongLine[] }> {
  const supabase = await createClient();
  const { data: song, error: fetchError } = await supabase
    .from("songs")
    .select("lines")
    .eq("id", id)
    .single();
  if (fetchError || !song) {
    return { error: fetchError?.message ?? "Song not found" };
  }

  const lines = (song.lines as SongLine[]) ?? [];
  const missingIdxs = lines
    .map((_, i) => i)
    .filter((i) => !lines[i].hint?.trim());
  if (missingIdxs.length === 0) return { lines };

  let analysis: LineAnalysis[];
  try {
    analysis = await analyzeSongLines(missingIdxs.map((i) => lines[i].text));
  } catch (err) {
    console.error("[backfillSongAnalysis] analysis failed:", err);
    return { error: "Analysis failed" };
  }

  const nextLines = lines.map((l, i) => {
    const j = missingIdxs.indexOf(i);
    if (j === -1) return l;
    return {
      ...l,
      hint: analysis[j]?.translation ?? "",
      vocabNotes: analysis[j]?.vocabNotes ?? "",
      grammarNotes: analysis[j]?.grammarNotes ?? "",
    };
  });

  const { error } = await supabase
    .from("songs")
    .update({ lines: nextLines })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/songs");
  return { lines: nextLines };
}

// レビュー突入時: 自分の訳と公式訳が両方揃っていて、まだコメントがない行にだけ
// 「違いのコメント」を生成する。生成済みの行は保存済みデータをそのまま使うので
// レビューページを開くたびにAPIを呼ぶことはない
export async function generateDiffComments(
  id: string,
): Promise<{ error?: string; lines?: SongLine[] }> {
  const supabase = await createClient();
  const { data: song, error: fetchError } = await supabase
    .from("songs")
    .select("lines")
    .eq("id", id)
    .single();
  if (fetchError || !song) {
    return { error: fetchError?.message ?? "Song not found" };
  }

  const lines = (song.lines as SongLine[]) ?? [];
  const targetIdxs = lines
    .map((_, i) => i)
    .filter(
      (i) =>
        lines[i].translation.trim().length > 0 &&
        lines[i].hint.trim().length > 0 &&
        !lines[i].diffComment?.trim(),
    );
  if (targetIdxs.length === 0) return { lines };

  let comments: string[];
  try {
    comments = await compareTranslations(
      targetIdxs.map((i) => ({
        text: lines[i].text,
        own: lines[i].translation,
        reference: lines[i].hint,
      })),
    );
  } catch (err) {
    console.error("[generateDiffComments] failed:", err);
    return { error: "Failed to generate comments" };
  }

  const nextLines = lines.map((l, i) => {
    const j = targetIdxs.indexOf(i);
    return j === -1 ? l : { ...l, diffComment: comments[j] ?? "" };
  });

  const { error } = await supabase
    .from("songs")
    .update({ lines: nextLines })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/songs");
  return { lines: nextLines };
}

export async function deleteSong(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("songs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/songs");
  return {};
}
