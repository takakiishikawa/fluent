"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import { revalidatePath } from "next/cache";
import { extractYoutubeVideoId } from "@/lib/youtube";
import type { Song, SongLine } from "@/lib/types";

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
  return texts.map((text) => ({ text, translation: "" }));
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
