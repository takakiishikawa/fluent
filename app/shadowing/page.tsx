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
import { Plus, ListVideo, ExternalLink, Check, Lock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@takaki/go-design-system";
import { useCurrentLanguage } from "@/lib/language-context";
import type { YoutubeChannel, YoutubeVideo } from "@/lib/types";

type VideoWithLap = YoutubeVideo & { lapCount: number };
const ROUNDS = [1, 2, 3] as const;
type Round = (typeof ROUNDS)[number];

type ChannelPlaylist = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  itemCount: number;
};

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
  const [showAddPlaylistModal, setShowAddPlaylistModal] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [fetchingPlaylist, setFetchingPlaylist] = useState(false);
  const [playlistFetchError, setPlaylistFetchError] = useState("");
  const [channelPlaylists, setChannelPlaylists] = useState<ChannelPlaylist[] | null>(null);
  const [loadingChannelPlaylists, setLoadingChannelPlaylists] = useState(false);
  const [importingPlaylistId, setImportingPlaylistId] = useState<string | null>(null);

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
      toast.error("Failed to record");
      return;
    }

    toast.success(`Round ${nextLap} done!`);
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
      toast.error("Failed to delete");
      return;
    }

    toast.success("Video deleted");
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
        setVideoFetchError(data.error ?? "Failed to fetch");
        return;
      }

      toast.success(`Added "${data.title}"`);
      setShowAddVideoModal(false);
      setVideoUrl("");
      await loadData();
    } catch {
      setVideoFetchError("Network error");
    } finally {
      setFetchingVideo(false);
    }
  };

  const importPlaylist = async (url: string) => {
    setPlaylistFetchError("");
    try {
      const res = await fetch("/api/youtube-playlist-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistUrl: url, language }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPlaylistFetchError(data.error ?? "Failed to fetch");
        return false;
      }

      toast.success(`Added ${data.videoCount} video(s) from "${data.channelName}"`);
      setShowAddPlaylistModal(false);
      setPlaylistUrl("");
      setChannelPlaylists(null);
      await loadData();
      return true;
    } catch {
      setPlaylistFetchError("Network error");
      return false;
    }
  };

  const handleFetchPlaylist = async () => {
    if (!playlistUrl.trim()) return;
    setFetchingPlaylist(true);
    await importPlaylist(playlistUrl.trim());
    setFetchingPlaylist(false);
  };

  const handleSelectChannelPlaylist = async (playlistId: string) => {
    setImportingPlaylistId(playlistId);
    await importPlaylist(`https://www.youtube.com/playlist?list=${playlistId}`);
    setImportingPlaylistId(null);
  };

  const loadChannelPlaylists = useCallback(async () => {
    setLoadingChannelPlaylists(true);
    try {
      const res = await fetch(`/api/youtube-channel-playlists?language=${language}`);
      const data = await res.json();
      setChannelPlaylists(res.ok ? data.playlists ?? [] : []);
    } catch {
      setChannelPlaylists([]);
    } finally {
      setLoadingChannelPlaylists(false);
    }
  }, [language]);

  return (
    <div className="w-full max-w-[980px]">
      <div className="mb-1.5 flex items-center justify-between">
        <div
          className="text-[12.5px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--color-accent)" }}
        >
          Shadowing
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setShowAddPlaylistModal(true);
              if (channelPlaylists === null) loadChannelPlaylists();
            }}
            size="sm"
            variant="outline"
          >
            <ListVideo className="h-4 w-4 mr-1.5" />
            Add playlist
          </Button>
          <Button
            onClick={() => setShowAddVideoModal(true)}
            size="sm"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add video
          </Button>
        </div>
      </div>
      <h1 className="mb-[22px] text-[30px] font-bold text-foreground">
        {language === "en" ? "Ryan Suzuki" : channel?.channel_name || "Shadowing"}
      </h1>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : !channel || videos.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="font-medium">No videos yet</p>
          <p className="text-sm mt-1">
            Add one with &quot;Add video&quot; or &quot;Add playlist&quot;
          </p>
        </div>
      ) : (
        <>
          <div
            className="mb-[22px] flex items-center gap-[22px]"
            style={{ borderBottom: "1px solid var(--color-border-default)" }}
          >
            {ROUNDS.map((r) => {
              const count = videos.filter((v) => v.lapCount >= r).length;
              return (
                <button
                  key={r}
                  onClick={() => setRound(r)}
                  className="flex items-baseline gap-1.5 pb-2 pt-2 text-[14.5px] font-semibold transition-colors"
                  style={{
                    color: round === r ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    borderBottom: round === r ? "2px solid var(--color-primary)" : "2px solid transparent",
                  }}
                >
                  Round {r}
                  <span className="text-[12px] font-medium text-muted-foreground">
                    ({count}/{videos.length})
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="overflow-hidden rounded-[20px] px-2"
            style={{ border: "1px solid var(--color-border-default)" }}
          >
            {videos.map((video, i) => (
              <VideoRow
                key={video.id}
                position={i + 1}
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
            <DialogTitle>Add video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Video URL</label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFetchVideo();
                }}
              />
              <p className="text-xs text-muted-foreground">
                e.g. https://www.youtube.com/watch?v=xxxxxxxxxxx /
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
                {fetchingVideo ? "Fetching..." : "Add video"}
              </Button>
            </FormActions>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add playlist modal */}
      <Dialog
        open={showAddPlaylistModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddPlaylistModal(false);
            setPlaylistUrl("");
            setPlaylistFetchError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingChannelPlaylists ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Loading playlists...
              </p>
            ) : channelPlaylists && channelPlaylists.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {language === "en" ? "Ryan Suzuki" : "Channel"}&apos;s playlists
                </label>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {channelPlaylists.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectChannelPlaylist(p.id)}
                      disabled={importingPlaylistId !== null}
                      className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-surface-subtle)] disabled:opacity-50"
                    >
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt=""
                          className="h-10 w-16 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="h-10 w-16 shrink-0 rounded bg-muted" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {p.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {importingPlaylistId === p.id
                          ? "Importing..."
                          : `${p.itemCount} videos`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Or paste a playlist URL</label>
              <Input
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="https://www.youtube.com/playlist?list=..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFetchPlaylist();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Imports every video in the playlist. Videos outside a playlist can be
                added individually with &quot;Add video&quot;.
              </p>
            </div>
            {playlistFetchError && (
              <p className="text-sm text-destructive">{playlistFetchError}</p>
            )}
            <FormActions>
              <Button
                onClick={handleFetchPlaylist}
                disabled={fetchingPlaylist || !playlistUrl.trim()}
              >
                {fetchingPlaylist ? "Fetching..." : "Add playlist"}
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
  video,
  round,
  onMarkDone,
  onDelete,
}: {
  position: number;
  video: VideoWithLap;
  round: Round;
  onMarkDone: (id: string, currentLap: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isDoneThisRound = video.lapCount >= round;
  const canMark = video.lapCount === round - 1;
  const locked = !isDoneThisRound && !canMark;

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
            "text-[13.5px] font-medium leading-snug",
            isDoneThisRound ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {video.title}
        </p>
      </div>
      <button
        onClick={handleComplete}
        disabled={marking || locked}
        title={locked ? "Finish the previous round first" : undefined}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-default"
        style={{
          border: `2px solid ${isDoneThisRound ? "var(--color-primary)" : "var(--color-border-default)"}`,
          background: isDoneThisRound
            ? "var(--color-primary)"
            : locked
              ? "var(--color-surface-subtle)"
              : "transparent",
          color: isDoneThisRound ? "var(--color-surface)" : "var(--color-text-secondary)",
        }}
      >
        {isDoneThisRound ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ) : locked ? (
          <Lock className="h-3 w-3" />
        ) : null}
      </button>
      <Button
        onClick={handleDelete}
        disabled={deleting}
        title="Delete"
        variant="ghost"
        size="sm"
        className="shrink-0 p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 disabled:opacity-30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </a>
  );
}
