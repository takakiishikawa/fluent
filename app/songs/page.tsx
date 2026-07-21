"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Input,
  Textarea,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@takaki/go-design-system";
import {
  Plus,
  Music,
  Rewind,
  FastForward,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  listSongs,
  createSong,
  updateSongLines,
  fetchYoutubeMeta,
} from "@/app/actions/songs";
import { extractYoutubeVideoId } from "@/lib/youtube";
import type { Song, SongLine } from "@/lib/types";
import { YoutubePlayer, type YoutubePlayerHandle } from "@/components/youtube-player";

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [lines, setLines] = useState<SongLine[]>([]);
  const [playing, setPlaying] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newLyrics, setNewLyrics] = useState("");
  const [creating, setCreating] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const fetchedForVideoId = useRef<string | null>(null);

  async function handleVideoUrlBlur() {
    const videoId = extractYoutubeVideoId(newVideoUrl);
    if (!videoId || fetchedForVideoId.current === videoId) return;
    fetchedForVideoId.current = videoId;
    setFetchingMeta(true);
    const meta = await fetchYoutubeMeta(newVideoUrl);
    setFetchingMeta(false);
    if (!meta) return;
    if (meta.title) setNewTitle(meta.title);
    if (meta.artist) setNewArtist(meta.artist);
  }
  const playerRef = useRef<YoutubePlayerHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listSongs();
    setSongs(data);
    setActiveId((prev) => prev ?? data[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(
    () => songs.find((s) => s.id === activeId) ?? null,
    [songs, activeId],
  );

  useEffect(() => {
    setLines(active?.lines ?? []);
    setLineIndex(0);
  }, [active?.id, active?.lines]);

  const currentLine = lines[lineIndex] ?? null;

  function handleTranslationChange(text: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === lineIndex ? { ...l, translation: text } : l)),
    );
  }

  // Google翻訳による参考訳（ヒント）。自分で和訳するときの補助として表示するだけで、
  // translation欄には自動で入れない
  const [showHint, setShowHint] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [hint, setHint] = useState<{ text: string; translation: string } | null>(null);
  const hintCache = useRef(new Map<string, string>());

  useEffect(() => {
    if (!showHint || !currentLine) return;
    const key = currentLine.text;
    const cached = hintCache.current.get(key);
    if (cached) {
      setHint({ text: key, translation: cached });
      return;
    }
    let cancelled = false;
    setHintLoading(true);
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [key] }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || `翻訳API エラー (${r.status})`);
        return d as { translations?: string[] };
      })
      .then((d) => {
        if (cancelled) return;
        const t = d.translations?.[0];
        if (t) {
          hintCache.current.set(key, t);
          setHint({ text: key, translation: t });
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to fetch translation hint");
      })
      .finally(() => {
        if (!cancelled) setHintLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHint, currentLine?.text]);

  async function persistLines(next: SongLine[]) {
    if (!active) return;
    const { error } = await updateSongLines(active.id, next);
    if (error) {
      toast.error("Failed to save");
      return;
    }
    setSongs((prev) =>
      prev.map((s) => (s.id === active.id ? { ...s, lines: next } : s)),
    );
  }

  async function handleCreate() {
    if (!newVideoUrl.trim() || !newLyrics.trim()) return;
    setCreating(true);
    const { error, song } = await createSong({
      title: newTitle.trim(),
      artist: newArtist.trim(),
      videoUrl: newVideoUrl.trim(),
      lyrics: newLyrics,
    });
    setCreating(false);
    if (error || !song) {
      toast.error(error ?? "Failed to add song");
      return;
    }
    setSongs((prev) => [song, ...prev]);
    setActiveId(song.id);
    setShowNewModal(false);
    setNewTitle("");
    setNewArtist("");
    setNewVideoUrl("");
    setNewLyrics("");
    fetchedForVideoId.current = null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div
      className="flex w-full min-h-0 flex-col"
      style={{ height: "calc(100svh - 2rem)" }}
    >
      <div
        className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--color-accent)" }}
      >
        Songs
      </div>
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[30px] font-bold text-foreground">
          Turn songs you love into practice
        </h1>
        <div className="flex items-center gap-2">
          {songs.length > 0 && (
            <Select value={activeId ?? undefined} onValueChange={setActiveId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Choose a song" />
              </SelectTrigger>
              <SelectContent>
                {songs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                    {s.artist ? ` — ${s.artist}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            variant="outline"
            title="Add song"
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!active ? (
        <EmptyState
          className="flex-1"
          icon={<Music className="h-8 w-8" />}
          title="No songs yet"
          description='Add one with "Add song" — paste a YouTube link and the lyrics, then translate it line by line.'
        />
      ) : (
        <div
          className="grid min-h-0 flex-1 gap-[22px]"
          style={{ gridTemplateColumns: "1fr 340px" }}
        >
          {/* 左カラム：プレイヤー＋現在行の翻訳 */}
          <div
            className="flex h-full flex-col overflow-y-auto rounded-[20px] p-[22px]"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <p className="mb-2 truncate text-[15px] font-bold text-foreground">
              {active.title}
            </p>

            <YoutubePlayer
              key={active.id}
              ref={playerRef}
              videoId={active.youtube_video_id}
              onPlayingChange={setPlaying}
            />

            <div className="mt-3.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <span />
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => playerRef.current?.seekBy(-10)}
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)" }}
                >
                  <Rewind className="h-4 w-4" />
                </button>
                <button
                  onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.play())}
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => playerRef.current?.seekBy(10)}
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)" }}
                >
                  <FastForward className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setLineIndex((i) => Math.max(0, i - 1))}
                  disabled={lineIndex === 0}
                  title="Previous line"
                  className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
                  style={{ border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)" }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLineIndex((i) => Math.min(lines.length - 1, i + 1))}
                  disabled={lineIndex >= lines.length - 1}
                  title="Next line"
                  className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
                  style={{ border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)" }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {currentLine && (
              <div
                className="mt-[18px] flex flex-1 flex-col rounded-[16px] p-5"
                style={{ background: "var(--color-surface-subtle)" }}
              >
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                      {lineIndex + 1}/{lines.length}
                    </span>
                    <p className="text-[20px] font-bold leading-snug text-foreground">
                      {currentLine.text}
                    </p>
                    {showHint && (
                      <p className="text-[13px] italic text-muted-foreground">
                        {hintLoading
                          ? "Translating…"
                          : hint?.text === currentLine.text
                            ? `— ${hint.translation}`
                            : ""}
                      </p>
                    )}
                  </div>
                  <label className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    JA
                    <Switch checked={showHint} onCheckedChange={setShowHint} />
                  </label>
                </div>
                <Textarea
                  value={currentLine.translation}
                  onChange={(e) => handleTranslationChange(e.target.value)}
                  onBlur={() => persistLines(lines)}
                  placeholder="このフレーズを日本語に訳してみましょう..."
                  rows={1}
                  className="resize-none text-[14px]"
                  style={{ background: "var(--color-surface)" }}
                />
              </div>
            )}
          </div>

          {/* 右カラム：全歌詞のトランスクリプト */}
          <div
            className="h-full overflow-y-auto rounded-[20px] p-2"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            {lines.map((line, i) => {
              const isActive = i === lineIndex;
              return (
                <button
                  key={i}
                  onClick={() => setLineIndex(i)}
                  className="mb-0.5 w-full rounded-[12px] px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: isActive ? "var(--color-primary-soft)" : "transparent",
                  }}
                >
                  <p
                    className="text-[13px] leading-snug"
                    style={{
                      color: isActive ? "var(--color-primary)" : "var(--color-text-primary)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {line.text}
                  </p>
                  {line.translation && (
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground line-clamp-1">
                      {line.translation}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Dialog
        open={showNewModal}
        onOpenChange={(open) => {
          setShowNewModal(open);
          if (!open) fetchedForVideoId.current = null;
        }}
      >
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add song</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
              onBlur={handleVideoUrlBlur}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="text-[12px] text-muted-foreground">
              {fetchingMeta
                ? "Fetching title & artist from YouTube…"
                : "Title and artist are filled in automatically from the video — edit if needed."}
            </p>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Song title (auto-filled)"
            />
            <Input
              value={newArtist}
              onChange={(e) => setNewArtist(e.target.value)}
              placeholder="Artist (auto-filled)"
            />
            <Textarea
              value={newLyrics}
              onChange={(e) => setNewLyrics(e.target.value)}
              placeholder="Paste the full lyrics here"
              rows={8}
              className="text-[13px]"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={creating || !newVideoUrl.trim() || !newLyrics.trim()}
            >
              {creating ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
