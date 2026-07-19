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
import { Plus, ExternalLink, CheckCircle, Trash2 } from "lucide-react";
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
        {channel?.channel_name || "シャドーイング"}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
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

function VideoCard({
  video,
  round,
  onMarkDone,
  onDelete,
}: {
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
      className={cn(
        "group relative rounded-[20px] border border-[var(--color-border-default)] bg-card overflow-hidden flex flex-col transition-all cursor-pointer",
        "hover:border-[var(--color-border-strong)] hover:-translate-y-0.5",
      )}
    >
      <div className="aspect-video bg-muted relative overflow-hidden">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ExternalLink className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {isDoneThisRound && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "var(--color-overlay-default)" }}
          >
            <CheckCircle className="h-6 w-6 text-white drop-shadow" />
          </div>
        )}
        <Button
          onClick={handleDelete}
          disabled={deleting}
          title="削除"
          variant="ghost"
          size="sm"
          className="absolute top-2 left-2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all disabled:opacity-30 cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="px-3 pt-3 pb-10">
        <p
          className={cn(
            "text-sm font-medium line-clamp-2 leading-snug transition-colors",
            isDoneThisRound
              ? "text-muted-foreground"
              : "group-hover:text-primary",
          )}
        >
          {video.title}
        </p>
        {video.duration && (
          <p
            className={cn(
              "text-xs mt-1",
              isDoneThisRound
                ? "text-muted-foreground/60"
                : "text-muted-foreground",
            )}
          >
            {video.duration}
          </p>
        )}
      </div>

      <div className="absolute bottom-2.5 right-2.5">
        {isDoneThisRound ? (
          <Button variant="outline" size="sm" disabled className="cursor-default">
            ✓ Done
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={marking || !canMark}
            title={!canMark ? "前のRoundを先に完了してください" : undefined}
            className="cursor-pointer"
          >
            {marking ? "記録中..." : "Mark done"}
          </Button>
        )}
      </div>
    </a>
  );
}
