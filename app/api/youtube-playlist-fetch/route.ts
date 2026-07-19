import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const STANDALONE_CHANNEL_URL = "nativego:standalone-videos";

// ISO 8601 duration → display string (e.g. "1:30", "12:05")
function formatDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = parseInt(m[1] ?? "0");
  const min = parseInt(m[2] ?? "0");
  const sec = parseInt(m[3] ?? "0");
  if (h > 0)
    return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const listParam = url.searchParams.get("list");
    if (listParam) return listParam;
  } catch {
    // not a URL — fall through and treat as a raw playlist ID
  }
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { playlistUrl, language } = body as {
    playlistUrl: string;
    language?: "en" | "vi";
  };
  const lang: "en" | "vi" = language === "vi" ? "vi" : "en";

  const playlistId = playlistUrl ? extractPlaylistId(playlistUrl) : null;
  if (!playlistId) {
    return NextResponse.json(
      { error: "有効なプレイリストURLを入力してください（例: https://www.youtube.com/playlist?list=...）" },
      { status: 400 },
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube API key is not configured" },
      { status: 500 },
    );
  }

  // 固定チャンネルを取得（VI は「お気に入り」を優先、無ければ最初の1件、それも無ければ新規作成）
  const { data: channels } = await supabase
    .from("youtube_channels")
    .select("id, channel_name, channel_url")
    .eq("language", lang)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  let fixedChannel =
    (lang === "vi"
      ? channels?.find((c) => c.channel_url === STANDALONE_CHANNEL_URL)
      : null) ??
    channels?.[0] ??
    null;

  type RawVideo = {
    videoId: string;
    title: string;
    thumbnailUrl: string | null;
    publishedAt: string | null;
    channelTitle: string | null;
  };
  const rawVideos: RawVideo[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.error) {
      return NextResponse.json(
        { error: "プレイリストが見つかりませんでした" },
        { status: 404 },
      );
    }

    for (const item of data.items ?? []) {
      const videoId: string | undefined = item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      const title: string = item.snippet?.title ?? "";
      if (title === "Deleted video" || title === "Private video") continue;

      rawVideos.push({
        videoId,
        title,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? null,
        publishedAt: item.snippet.publishedAt?.slice(0, 10) ?? null,
        channelTitle: item.snippet?.videoOwnerChannelTitle ?? null,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  if (rawVideos.length === 0) {
    return NextResponse.json(
      { error: "プレイリストに動画が見つかりませんでした" },
      { status: 404 },
    );
  }

  // 固定チャンネルが無ければ、プレイリストの最初の動画のチャンネル名で新規作成
  if (!fixedChannel) {
    const channelName = rawVideos[0].channelTitle || "Playlist";
    const { data: newChannel, error: channelError } = await supabase
      .from("youtube_channels")
      .insert({
        user_id: user.id,
        channel_name: channelName,
        channel_url: `nativego:playlist-${playlistId}`,
        language: lang,
      })
      .select("id, channel_name, channel_url")
      .single();
    if (channelError || !newChannel) {
      return NextResponse.json(
        { error: "チャンネルの保存に失敗しました" },
        { status: 500 },
      );
    }
    fixedChannel = newChannel;
  }
  const channel = fixedChannel;

  // 既存動画との重複を除外
  const { data: existingVideos } = await supabase
    .from("youtube_videos")
    .select("video_url")
    .eq("channel_id", channel.id);
  const existingUrls = new Set(
    (existingVideos ?? []).map((v) => v.video_url),
  );

  const durationMap = new Map<string, string>();
  for (let i = 0; i < rawVideos.length; i += 50) {
    const batchIds = rawVideos
      .slice(i, i + 50)
      .map((v) => v.videoId)
      .join(",");
    const detailRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batchIds}&key=${apiKey}`,
    );
    const detailData = await detailRes.json();
    for (const item of detailData.items ?? []) {
      durationMap.set(item.id, item.contentDetails?.duration ?? "");
    }
  }

  const { data: sortMax } = await supabase
    .from("youtube_videos")
    .select("sort_order")
    .eq("channel_id", channel.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let sortOrder = (sortMax?.sort_order ?? -1) + 1;

  const videos = [];
  for (const v of rawVideos) {
    const videoUrl = `https://www.youtube.com/watch?v=${v.videoId}`;
    if (existingUrls.has(videoUrl)) continue;
    const isoDuration = durationMap.get(v.videoId) ?? "";
    videos.push({
      channel_id: channel.id,
      title: v.title,
      video_url: videoUrl,
      thumbnail_url: v.thumbnailUrl,
      published_at: v.publishedAt,
      duration: isoDuration ? formatDuration(isoDuration) : null,
      sort_order: sortOrder++,
      language: lang,
    });
  }

  if (videos.length > 0) {
    const { error: videosError } = await supabase
      .from("youtube_videos")
      .insert(videos);
    if (videosError) {
      return NextResponse.json(
        { error: "動画の保存に失敗しました" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    channelName: channel.channel_name,
    videoCount: videos.length,
    skipped: rawVideos.length - videos.length,
  });
}
