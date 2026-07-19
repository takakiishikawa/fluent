"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Input,
  FormActions,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@takaki/go-design-system";
import { Plus, ExternalLink, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@takaki/go-design-system";
import { useCurrentLanguage } from "@/lib/language-context";
import type { YoutubeChannel, YoutubeVideo } from "@/lib/types";

type VideoWithLap = YoutubeVideo & { lapCount: number };
const ROUNDS = [1, 2, 3] as const;
type Round = (typeof ROUNDS)[number];

const STANDALONE_CHANNEL_URL = "nativego:standalone-videos";

export default function ShadowingPage() {
  const supabase = createClient();
  const language = useCurrentLanguage();

  const [channel, setChannel] = useState<YoutubeChannel | null>(null);
  const [videos, setVideos] = useState<VideoWithLap[]>([]);
  const [round, setRound] = useState<Round>(1);
  const [loading, setLoading] = useState(true);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [fetchingVideo, setFetchingVideo] = useState(false);
  const [videoFetchError, setVideoFetchError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: channels } = await supabase
      .from("youtube_channels")
      .select("*")
      .eq("language", language)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    // 固定の1チャンネルのみ表示。VI は「お気に入り」を優先。
    const fixed =
      (language === "vi"
        ? channels?.find((c) => c.channel_url === STANDALONE_CHANNEL_URL)
        : null) ??
      channels?.[0] ??
      null;

    setChannel(fixed);

    if (!fixed) {
      setVideos([]);
      setLoading(false);
      return;
    }

    const [videosResult, logsResult] = await Promise.all([
      supabase
        .from("youtube_videos")
        .select("*")
        .eq("channel_id", fixed.id)
        .order("sort_order"),
      supabase
        .from("youtube_logs")
        .select("video_id")
        .eq("language", language),
    ]);

    const logs = logsResult.data ?? [];
    const lapCounts = new Map<string, number>();
    for (const log of logs) {
      lapCounts.set(log.video_id, (lapCounts.get(log.video_id) ?? 0) + 1);
    }

    setVideos(
      (videosResult.data ?? []).map((v) => ({
        ...v,
        lapCount: lapCounts.get(v.id) ?? 0,
      })),
    );
    setLoading(false);
  }, [supabase, language]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkDone = async (videoId: string, currentLap: number) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const nextLap = currentLap + 1;

    const { error } = await supabase.from("youtube_logs").insert({
      user_id: user.id,
      video_id: videoId,
      lap: nextLap,
      language,
    });

    if (error) {
      toast.error("記録に失敗しました");
      return;
    }

    toast.success(`Round ${nextLap} 完了！`);
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, lapCount: nextLap } : v)),
    );
  };

  const handleDeleteVideo = async (videoId: string): Promise<void> => {
    await supabase.from("youtube_logs").delete().eq("video_id", videoId);
    const { error } = await supabase
      .from("youtube_videos")
      .delete()
      .eq("id", videoId);

    if (error) {
      toast.error("削除に失敗しました");
      return;
    }

    toast.success("動画を削除しました");
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
  };

  const handleFetchVideo = async () => {
    if (!videoUrl.trim()) return;
    setFetchingVideo(true);
    setVideoFetchError("");

    try {
      const res = await fetch("/api/youtube-video-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrl.trim(), language }),
      });
      const data = await res.json();

      if (!res.ok) {
        setVideoFetchError(data.error ?? "取得に失敗しました");
        return;
      }

      toast.success(`「${data.title}」を追加しました`);
      setShowAddVideoModal(false);
      setVideoUrl("");
      await loadData();
    } catch {
      setVideoFetchError("ネットワークエラーが発生しました");
    } finally {
      setFetchingVideo(false);
    }
  };

  const doneCount = videos.filter((v) => v.lapCount >= round).length;

  return (
    <div className="w-full max-w-[980px]">
      <div className="mb-1.5 flex items-center justify-between">
        <div
          className="text-[12.5px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--color-accent)" }}
        >
          Shadowing
        </div>
        <Button
          onClick={() => setShowAddVideoModal(true)}
          size="sm"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          動画を追加
        </Button>
      </div>
      <h1 className="mb-[22px] text-[30px] font-bold text-foreground">
        {language === "en" ? "Ryan Suzuki" : channel?.channel_name || "シャドーイング"}
      </h1>

      {loading ? (
        <div className="text-muted-foreground text-sm">読み込み中...</div>
      ) : !channel || videos.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="font-medium">動画が登録されていません</p>
          <p className="text-sm mt-1">
            「動画を追加」からYouTube動画を登録してください
          </p>
        </div>
      ) : (
        <>
          <div
            className="mb-[22px] flex items-center gap-[22px]"
            style={{ borderBottom: "1px solid var(--color-border-default)" }}
          >
            {ROUNDS.map((r) => (
              <button
                key={r}
                onClick={() => setRound(r)}
                className="pb-2 pt-2 text-[14.5px] font-semibold transition-colors"
                style={{
                  color: round === r ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  borderBottom: round === r ? "2px solid var(--color-primary)" : "2px solid transparent",
                }}
              >
                Round {r}
              </button>
            ))}
            <span className="ml-auto pb-2 text-[13px] text-muted-foreground">
              {doneCount}/{videos.length} completed
            </span>
          </div>

          <div
            className="overflow-hidden rounded-[20px] px-2"
            style={{ border: "1px solid var(--color-border-default)" }}
          >
            {videos.map((video, i) => (
              <VideoRow
                key={video.id}
                position={i + 1}
                channelName={
                  language === "en" ? "Ryan Suzuki" : channel?.channel_name || ""
                }
                video={video}
                round={round}
                onMarkDone={handleMarkDone}
                onDelete={handleDeleteVideo}
              />
            ))}
          </div>
        </>
      )}

      {/* Add single video modal */}
      <Dialog
        open={showAddVideoModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddVideoModal(false);
            setVideoUrl("");
            setVideoFetchError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>動画を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">動画URL</label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFetchVideo();
                }}
              />
              <p className="text-xs text-muted-foreground">
                例: https://www.youtube.com/watch?v=xxxxxxxxxxx /
                https://youtu.be/xxxxxxxxxxx
              </p>
            </div>
            {videoFetchError && (
              <p className="text-sm text-destructive">{videoFetchError}</p>
            )}
            <FormActions>
              <Button
                onClick={handleFetchVideo}
                disabled={fetchingVideo || !videoUrl.trim()}
              >
                {fetchingVideo ? "取得中..." : "動画を追加する"}
              </Button>
            </FormActions>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VideoRow({
  position,
  channelName,
  video,
  round,
  onMarkDone,
  onDelete,
}: {
  position: number;
  channelName: string;
  video: VideoWithLap;
  round: Round;
  onMarkDone: (id: string, currentLap: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isDoneThisRound = video.lapCount >= round;
  const canMark = video.lapCount === round - 1;

  const handleComplete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canMark) return;
    setMarking(true);
    await onMarkDone(video.id, video.lapCount);
    setMarking(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    await onDelete(video.id);
    setDeleting(false);
  };

  return (
    <a
      href={video.video_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3.5 py-3"
      style={{ borderTop: "1px solid var(--color-border-default)" }}
    >
      <span className="w-5 shrink-0 text-center text-[13px] font-semibold text-muted-foreground">
        {position}
      </span>
      <div className="relative h-[64px] w-[112px] shrink-0 overflow-hidden rounded-[8px] bg-muted">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ExternalLink className="h-5 w-5 text-muted-foreground/30" />
          </div>
        )}
        {video.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10.5px] text-white">
            {video.duration}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13.5px] font-semibold leading-snug",
            isDoneThisRound ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {video.title}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">{channelName}</p>
      </div>
      <button
        onClick={handleComplete}
        disabled={marking || (!isDoneThisRound && !canMark)}
        title={!isDoneThisRound && !canMark ? "前のRoundを先に完了してください" : undefined}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-default"
        style={{
          border: `2px solid ${isDoneThisRound ? "var(--color-primary)" : "var(--color-border-default)"}`,
          background: isDoneThisRound ? "var(--color-primary)" : "transparent",
          color: "var(--color-surface)",
        }}
      >
        {isDoneThisRound && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <Button
        onClick={handleDelete}
        disabled={deleting}
        title="削除"
        variant="ghost"
        size="sm"
        className="shrink-0 p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 disabled:opacity-30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </a>
  );
}
