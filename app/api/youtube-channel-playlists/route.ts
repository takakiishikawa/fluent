import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const STANDALONE_CHANNEL_URL = "nativego:standalone-videos";

// 固定チャンネルの channel_url からハンドル(@xxx)を抽出し、そのチャンネルが
// 持つ再生リスト一覧を返す。ユーザーがプレイリストURLを自分で探さなくて
// 済むようにするための一覧表示用。
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") === "vi" ? "vi" : "en";

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube API key is not configured" },
      { status: 500 },
    );
  }

  const { data: channels } = await supabase
    .from("youtube_channels")
    .select("channel_url")
    .eq("language", language)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  const fixed =
    (language === "vi"
      ? channels?.find((c) => c.channel_url === STANDALONE_CHANNEL_URL)
      : null) ??
    channels?.[0] ??
    null;

  const handleMatch = fixed?.channel_url?.match(/@([^/?\s]+)/);
  if (!handleMatch) {
    return NextResponse.json(
      { error: "チャンネルのハンドルが特定できませんでした。プレイリストURLを直接貼り付けてください。" },
      { status: 404 },
    );
  }
  const handle = handleMatch[1];

  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`,
  );
  const channelData = await channelRes.json();
  const channelId: string | undefined = channelData.items?.[0]?.id;
  if (!channelId) {
    return NextResponse.json(
      { error: "チャンネルが見つかりませんでした" },
      { status: 404 },
    );
  }

  type PlaylistItem = {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    itemCount: number;
  };
  const playlists: PlaylistItem[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlists");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("channelId", channelId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());
    const data = await res.json();

    for (const item of data.items ?? []) {
      playlists.push({
        id: item.id,
        title: item.snippet?.title ?? "",
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
        itemCount: item.contentDetails?.itemCount ?? 0,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return NextResponse.json({ playlists });
}
