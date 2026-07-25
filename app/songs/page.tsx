"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Input,
  Textarea,
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
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
  MoreVertical,
  Trash2,
  Check,
  Languages,
  ArrowLeft,
} from "lucide-react";
import {
  listSongs,
  createSong,
  updateSongLines,
  fetchYoutubeMeta,
  backfillSongAnalysis,
  generateDiffComments,
  deleteSong,
} from "@/app/actions/songs";
import { extractYoutubeVideoId } from "@/lib/youtube";
import type { Song, SongLine } from "@/lib/types";
import { YoutubePlayer, type YoutubePlayerHandle } from "@/components/youtube-player";

type Mode = "practice" | "review";

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("practice");
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
  const [startingReview, setStartingReview] = useState(false);
  const [showJaPopup, setShowJaPopup] = useState(false);
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

  // 曲を切り替えたときだけ行位置・モードをリセットする（保存のたびにリセットしない）
  useEffect(() => {
    setLineIndex(0);
    setMode("practice");
  }, [active?.id]);

  useEffect(() => {
    setLines(active?.lines ?? []);
  }, [active?.lines]);

  const currentLine = lines[lineIndex] ?? null;
  const translatedCount = lines.filter((l) => l.translation.trim().length > 0).length;
  const allTranslated = lines.length > 0 && translatedCount === lines.length;
  const allReviewed = lines.length > 0 && lines.every((l) => l.reviewed);

  function handleTranslationChange(text: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === lineIndex ? { ...l, translation: text } : l)),
    );
  }

  // 同じ歌詞（サビの繰り返しなど）が他にもあれば、そこにも同じ和訳を自動で反映する
  function applyDuplicateTranslations(arr: SongLine[], sourceIndex: number): SongLine[] {
    const sourceText = arr[sourceIndex]?.text.trim();
    const sourceTranslation = arr[sourceIndex]?.translation.trim();
    if (!sourceText || !sourceTranslation) return arr;
    return arr.map((l) =>
      l.text.trim() === sourceText && !l.translation.trim()
        ? { ...l, translation: sourceTranslation }
        : l,
    );
  }

  // 次に進む先は、既に和訳済み（自動反映も含む）の行を飛ばして、
  // まだ未入力の行にフォーカスが移るようにする
  function nextLineIndexToFocus(arr: SongLine[], from: number): number {
    let i = from + 1;
    while (i < arr.length - 1 && arr[i].translation.trim().length > 0) {
      i++;
    }
    return Math.min(i, arr.length - 1);
  }

  // 現在の行の和訳を確定し、重複行に反映してから保存する
  function commitCurrentTranslation(): SongLine[] {
    const filled = applyDuplicateTranslations(lines, lineIndex);
    setLines(filled);
    persistLines(filled);
    return filled;
  }

  const [backfilling, setBackfilling] = useState(false);

  // 追加当時に生成が未実装/一部失敗して hint が空のまま残っている曲を後から埋める
  useEffect(() => {
    if (!active) return;
    const hasMissingHint = active.lines.some((l) => !l.hint?.trim());
    if (!hasMissingHint) return;
    let cancelled = false;
    setBackfilling(true);
    backfillSongAnalysis(active.id)
      .then(({ lines: filled }) => {
        if (cancelled || !filled) return;
        // hint/vocab/grammarだけを反映し、その間にユーザーが編集した
        // translation/reviewed/diffCommentは現在のクライアント側の値を保つ
        setSongs((prev) =>
          prev.map((s) => {
            if (s.id !== active.id) return s;
            const merged = s.lines.map((l, i) => ({
              ...l,
              hint: filled[i]?.hint ?? l.hint,
              vocabNotes: filled[i]?.vocabNotes ?? l.vocabNotes,
              grammarNotes: filled[i]?.grammarNotes ?? l.grammarNotes,
            }));
            return { ...s, lines: merged };
          }),
        );
      })
      .finally(() => {
        if (!cancelled) setBackfilling(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

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

  function handleToggleReviewed(index: number) {
    const next = lines.map((l, i) =>
      i === index ? { ...l, reviewed: !l.reviewed } : l,
    );
    setLines(next);
    persistLines(next);
  }

  function handleStartReview() {
    if (!active || !allTranslated) return;
    setMode("review");
  }

  const [generatingComments, setGeneratingComments] = useState(false);

  // レビュー画面に入ったら、まだ「違いのコメント」がない行だけをバックグラウンドで
  // 生成する（画面遷移自体は待たせない）
  useEffect(() => {
    if (mode !== "review" || !active) return;
    const hasMissingComment = active.lines.some(
      (l) => l.translation.trim() && l.hint.trim() && !l.diffComment?.trim(),
    );
    if (!hasMissingComment) return;
    let cancelled = false;
    setGeneratingComments(true);
    generateDiffComments(active.id)
      .then(({ lines: updated }) => {
        if (cancelled || !updated) return;
        // diffCommentだけを反映し、生成中にユーザーがOKにしたり訳文を
        // 修正したりした内容(reviewed/translation)は上書きしない
        setSongs((prev) =>
          prev.map((s) => {
            if (s.id !== active.id) return s;
            const merged = s.lines.map((l, i) => ({
              ...l,
              diffComment: l.diffComment?.trim() ? l.diffComment : updated[i]?.diffComment ?? l.diffComment,
            }));
            return { ...s, lines: merged };
          }),
        );
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to generate comments");
      })
      .finally(() => {
        if (!cancelled) setGeneratingComments(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, active?.id]);

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

  async function handleDeleteSong(id: string) {
    if (!confirm("Delete this song? This can't be undone.")) return;
    const { error } = await deleteSong(id);
    if (error) {
      toast.error("Failed to delete song");
      return;
    }
    const next = songs.filter((s) => s.id !== id);
    setSongs(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    toast.success("Song deleted");
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
          {allReviewed && (
            <Button
              size="sm"
              variant="outline"
              title="View your translation"
              onClick={() => setShowJaPopup(true)}
            >
              <Languages className="h-4 w-4 mr-1.5" />
              JA
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            title="Add song"
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          {active && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" title="More options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleDeleteSong(active.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete this song
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {!active ? (
        <EmptyState
          className="flex-1"
          icon={<Music className="h-8 w-8" />}
          title="No songs yet"
          description='Add one with "Add song" — paste a YouTube link and the lyrics, then translate it line by line.'
        />
      ) : mode === "review" ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto rounded-[20px] p-[22px]"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setMode("practice")}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to practice
            </button>
            <span className="text-[12.5px] font-semibold text-muted-foreground">
              {lines.filter((l) => l.reviewed).length}/{lines.length} lines OK
            </span>
          </div>

          {generatingComments && (
            <p className="mb-4 px-1 text-[11.5px] text-muted-foreground">
              ✨ Generating comments comparing your translations with the
              official ones — they'll pop in below as they're ready. Feel
              free to start marking lines OK in the meantime.
            </p>
          )}

          {allReviewed && (
            <div
              className="mb-4 flex items-center gap-2 rounded-[14px] px-4 py-3 text-[13.5px] font-semibold"
              style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
            >
              <Check className="h-4 w-4" strokeWidth={3} />
              All lines reviewed — this song's translation is complete!
            </div>
          )}

          <div className="space-y-3">
            {lines.map((line, i) => (
              <div
                key={i}
                className="rounded-[16px] p-4"
                style={{ border: "1px solid var(--color-border-default)" }}
              >
                <div className="mb-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {i + 1}/{lines.length}
                    </span>
                    <p className="text-[16px] font-bold leading-snug text-foreground">
                      {line.text}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleReviewed(i)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
                    style={{
                      border: `1px solid ${line.reviewed ? "var(--color-primary)" : "var(--color-border-default)"}`,
                      background: line.reviewed ? "var(--color-primary)" : "transparent",
                      color: line.reviewed ? "var(--color-surface)" : "var(--color-text-secondary)",
                    }}
                  >
                    {line.reviewed && <Check className="h-3 w-3" strokeWidth={3} />}
                    {line.reviewed ? "OK" : "Mark as OK"}
                  </button>
                </div>

                <Textarea
                  value={line.translation}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, j) =>
                        j === i ? { ...l, translation: e.target.value } : l,
                      ),
                    )
                  }
                  onBlur={() => persistLines(lines)}
                  placeholder="このフレーズを日本語に訳してみましょう..."
                  rows={2}
                  className="mb-3 resize-none text-[14px]"
                  style={{ background: "var(--color-background)" }}
                />

                <div className="space-y-1.5 text-[13px] leading-relaxed">
                  <p>
                    <span className="font-semibold text-muted-foreground">Official: </span>
                    <span className="text-foreground">{line.hint || "—"}</span>
                  </p>
                  {line.vocabNotes && (
                    <p>
                      <span className="font-semibold text-muted-foreground">Vocab: </span>
                      <span className="text-foreground">{line.vocabNotes}</span>
                    </p>
                  )}
                  {line.grammarNotes && (
                    <p>
                      <span className="font-semibold text-muted-foreground">Grammar: </span>
                      <span className="text-foreground">{line.grammarNotes}</span>
                    </p>
                  )}
                  {line.diffComment && (
                    <p
                      className="mt-1.5 rounded-[10px] px-3 py-2"
                      style={{ background: "var(--color-surface-subtle)" }}
                    >
                      <span className="font-semibold" style={{ color: "var(--color-accent)" }}>
                        Comment:{" "}
                      </span>
                      <span className="text-foreground">{line.diffComment}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
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
                  onClick={() => {
                    const filled = commitCurrentTranslation();
                    setLineIndex(nextLineIndexToFocus(filled, lineIndex));
                  }}
                  disabled={lineIndex >= lines.length - 1}
                  title="Next line"
                  className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
                  style={{ border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)" }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {backfilling && (
              <p className="mt-3.5 px-1 text-[11.5px] text-muted-foreground">
                ✨ Analyzing lyrics in the background — vocab &amp; grammar notes
                for the review page will be ready shortly. You can keep
                translating in the meantime.
              </p>
            )}

            {currentLine && (
              <div
                className="mt-[18px] flex flex-col rounded-[16px] p-5"
                style={{ background: "var(--color-surface-subtle)" }}
              >
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                    {lineIndex + 1}/{lines.length}
                  </span>
                  <p className="text-[20px] font-bold leading-snug text-foreground">
                    {currentLine.text}
                  </p>
                </div>
                <Textarea
                  value={currentLine.translation}
                  onChange={(e) => handleTranslationChange(e.target.value)}
                  onBlur={() => commitCurrentTranslation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const filled = commitCurrentTranslation();
                      setLineIndex(nextLineIndexToFocus(filled, lineIndex));
                    }
                  }}
                  placeholder="このフレーズを日本語に訳してみましょう..."
                  rows={1}
                  className="resize-none text-[14px]"
                  style={{ background: "var(--color-surface)" }}
                />
                {lineIndex === lines.length - 1 && allTranslated && (
                  <div className="mt-3.5 flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold" style={{ color: "var(--color-primary)" }}>
                      All {lines.length} lines translated 🎉
                    </span>
                    <Button
                      size="sm"
                      disabled={startingReview || backfilling}
                      onClick={handleStartReview}
                    >
                      {startingReview ? "Preparing review..." : "Start review →"}
                    </Button>
                  </div>
                )}
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
                : "Title and artist are filled in automatically from the video."}
            </p>
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

      <Dialog open={showJaPopup} onOpenChange={setShowJaPopup}>
        <DialogContent className="max-h-[80vh] max-w-[560px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{active?.title} — Your translation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {active?.lines.map((line, i) => (
              <div key={i}>
                <p className="text-[14px] font-semibold leading-snug text-foreground">
                  {line.text}
                </p>
                <p className="text-[13px] leading-snug text-muted-foreground">
                  {line.translation}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
