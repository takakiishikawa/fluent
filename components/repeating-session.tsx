"use client";

import { useEffect, useRef, useState } from "react";
import { cn, toast } from "@takaki/go-design-system";
import type { Language, WordNote } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Star,
  X,
  Languages,
  Flag,
  MessageSquareText,
  ChefHat,
  Briefcase,
  Plane,
  Heart,
  BookOpen,
  Coffee,
  ShoppingBag,
  Home,
  Dumbbell,
  Code,
  Cat,
  Dog,
  Bike,
  Utensils,
  Music,
  Users,
  MapPin,
  Wallet,
  Shirt,
  Brain,
  Sparkles,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

const SPEEDS = [0.6, 0.8, 1.0, 1.2] as const;

const TOPIC_ICON_MAP: Record<string, LucideIcon> = {
  "chef-hat": ChefHat,
  briefcase: Briefcase,
  plane: Plane,
  heart: Heart,
  "book-open": BookOpen,
  coffee: Coffee,
  "shopping-bag": ShoppingBag,
  home: Home,
  dumbbell: Dumbbell,
  code: Code,
  cat: Cat,
  dog: Dog,
  bike: Bike,
  utensils: Utensils,
  music: Music,
  users: Users,
  "map-pin": MapPin,
  wallet: Wallet,
  shirt: Shirt,
  brain: Brain,
  sparkles: Sparkles,
  "message-circle": MessageCircle,
};

const stripSpeaker = (line: string) => line.replace(/^[AB]:\s*/i, "");

// ─── Stars ──────────────────────────────────────────────────────────
function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i <= value
              ? "fill-[var(--color-warning)] text-[color:var(--color-warning)]"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

// ─── Cycle ring (10回で卒業) ─────────────────────────────────────────
function CycleRing({ done, total }: { done: number; total: number }) {
  const size = 22;
  const sw = 3;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, done / total));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={sw}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ─── Session progress — chunked dots ────────────────────────────────
function SessionProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const dots = Math.min(10, Math.max(1, total));
  const perDot = total / dots;
  const currentDotIdx = Math.max(
    0,
    Math.min(dots - 1, Math.floor((current - 1) / perDot)),
  );
  const intoChunk = current - 1 - currentDotIdx * perDot;
  const partial =
    perDot <= 1 ? 1 : Math.max(0, Math.min(1, (intoChunk + 0.5) / perDot));
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: dots }).map((_, i) => {
        const active = i === currentDotIdx;
        const done = i < currentDotIdx;
        const isWide = active && perDot > 1;
        return (
          <span
            key={i}
            className={cn(
              "relative h-1.5 overflow-hidden rounded-full transition-all",
              done ? "bg-[color:var(--color-primary)]" : "bg-border",
            )}
            style={{
              width: active ? (isWide ? 36 : 26) : perDot > 1 ? 16 : 10,
            }}
          >
            {active && (
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--color-primary)]"
                style={{ width: `${partial * 100}%` }}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

// ─── Topic chip ─────────────────────────────────────────────────────
function TopicChip({ label, icon }: { label: string; icon: string | null }) {
  const Icon = (icon && TOPIC_ICON_MAP[icon]) || MessageCircle;
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-muted py-1 pl-1 pr-3.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-primary)]">
        <Icon className="h-4 w-4 text-white" />
      </span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </span>
  );
}

// ─── Study controls — flag toggle + memo (hover) ────────────────────
function StudyControls({
  studyFlag,
  onToggleStudyFlag,
  studyNote,
}: {
  studyFlag: boolean;
  onToggleStudyFlag: () => void;
  studyNote?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onToggleStudyFlag}
        title={studyFlag ? "学習したいリストから外す" : "学習したいリストに追加"}
        aria-pressed={studyFlag}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
          studyFlag
            ? "border-[color:var(--color-primary)] bg-[var(--color-primary)]/10 text-[color:var(--color-primary)]"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        <Flag className={cn("h-4 w-4", studyFlag && "fill-current")} />
      </button>
      {studyNote && (
        <span className="group relative flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground">
          <MessageSquareText className="h-4 w-4" />
          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-64 -translate-x-1/2 whitespace-pre-wrap rounded-lg border border-border bg-background px-3 py-2 text-left text-xs leading-relaxed text-foreground shadow-lg group-hover:block">
            {studyNote}
          </span>
        </span>
      )}
    </span>
  );
}

// ─── Highlighted line (pattern highlight + inline Word Wise) ─────────
const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/** word をトークン境界で探す（部分一致を避ける）。見つからなければ -1。 */
function findToken(text: string, word: string): number {
  if (!word) return -1;
  const lower = text.toLowerCase();
  const w = word.toLowerCase();
  let from = 0;
  while (from <= lower.length) {
    const idx = lower.indexOf(w, from);
    if (idx < 0) return -1;
    if (!isWordChar(text[idx - 1]) && !isWordChar(text[idx + word.length]))
      return idx;
    from = idx + 1;
  }
  return -1;
}

type Seg =
  | { kind: "plain"; text: string }
  | { kind: "pattern"; text: string }
  | { kind: "wise"; text: string; note: string };

function buildSegments(
  text: string,
  patternQuote: string | null | undefined,
  wordNotes: WordNote[] | null | undefined,
): Seg[] {
  type Marker = {
    start: number;
    end: number;
    kind: "pattern" | "wise";
    note?: string;
  };
  const markers: Marker[] = [];

  if (patternQuote) {
    const i = text.indexOf(patternQuote);
    if (i >= 0)
      markers.push({ start: i, end: i + patternQuote.length, kind: "pattern" });
  }
  const pat = markers[0];
  for (const n of wordNotes ?? []) {
    const i = findToken(text, n.word);
    if (i < 0) continue;
    const end = i + n.word.length;
    if (pat && i < pat.end && end > pat.start) continue;
    markers.push({ start: i, end, kind: "wise", note: n.note });
  }
  markers.sort((a, b) => a.start - b.start);

  const segs: Seg[] = [];
  let cursor = 0;
  for (const m of markers) {
    if (m.start < cursor) continue;
    if (m.start > cursor)
      segs.push({ kind: "plain", text: text.slice(cursor, m.start) });
    if (m.kind === "pattern") {
      segs.push({ kind: "pattern", text: text.slice(m.start, m.end) });
    } else {
      segs.push({
        kind: "wise",
        text: text.slice(m.start, m.end),
        note: m.note ?? "",
      });
    }
    cursor = m.end;
  }
  if (cursor < text.length)
    segs.push({ kind: "plain", text: text.slice(cursor) });
  return segs;
}

function HighlightedLine({
  text,
  patternQuote,
  wordNotes,
}: {
  text: string;
  patternQuote?: string | null;
  wordNotes?: WordNote[] | null;
}) {
  const segs = buildSegments(text, patternQuote, wordNotes);
  const hasWise = segs.some((s) => s.kind === "wise");
  return (
    <span className={hasWise ? "leading-[2.15]" : "leading-relaxed"}>
      {segs.map((s, i) => {
        if (s.kind === "plain") return <span key={i}>{s.text}</span>;
        if (s.kind === "pattern")
          return (
            <span
              key={i}
              className="rounded bg-[var(--color-primary)]/15 px-0.5 font-semibold text-[color:var(--color-primary)]"
            >
              {s.text}
            </span>
          );
        return (
          <span
            key={i}
            className="relative inline-block whitespace-nowrap pt-[20px] align-baseline"
          >
            <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-[13.5px] font-medium leading-none text-muted-foreground">
              {s.note}
            </span>
            <span className="border-b border-dotted border-[color:var(--color-primary)]/40">
              {s.text}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// ─── Bubble ─────────────────────────────────────────────────────────
function Bubble({
  line,
  active,
  showJa,
  jaText,
  jaLoading,
  patternQuote,
  wordNotes,
}: {
  line: string;
  active: boolean;
  showJa: boolean;
  jaText: string | null;
  jaLoading: boolean;
  patternQuote?: string | null;
  wordNotes?: WordNote[] | null;
}) {
  const isA = /^A:/i.test(line);
  const text = stripSpeaker(line);
  return (
    <div
      className={cn(
        "flex items-start gap-3 transition-opacity duration-200",
        isA ? "flex-row" : "flex-row-reverse",
        active ? "opacity-100" : "opacity-55",
      )}
    >
      <span
        className={cn(
          "mt-1.5 h-9 w-9 shrink-0 rounded-full",
          isA
            ? "bg-[color:var(--color-primary)]"
            : "bg-[color:var(--color-warning)]",
          active && "ring-2 ring-offset-2 ring-offset-background",
          active &&
            (isA
              ? "ring-[color:var(--color-primary)]"
              : "ring-[color:var(--color-warning)]"),
        )}
      />
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-[19px] text-foreground",
          isA ? "rounded-tl-sm" : "rounded-tr-sm",
          active
            ? cn(
                "font-medium",
                isA
                  ? "bg-[var(--color-primary)]/10"
                  : "bg-[var(--color-warning)]/10",
              )
            : "bg-muted",
        )}
      >
        <HighlightedLine
          text={text}
          patternQuote={patternQuote}
          wordNotes={wordNotes}
        />
        {showJa && (jaText || jaLoading) && (
          <div className="mt-2 border-t border-border/60 pt-2 text-sm leading-relaxed text-muted-foreground">
            {jaText ?? "翻訳中…"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Word list (VI — floats to the right of the conversation) ───────
function WordList({ notes }: { notes: WordNote[] }) {
  return (
    <aside className="absolute right-6 top-1/2 max-h-[78%] w-[228px] -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-[0_6px_24px_rgba(15,23,42,0.07)]">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" />
        単語
      </div>
      <ul className="flex flex-col">
        {notes.map((n, i) => (
          <li
            key={i}
            className={cn(
              "py-2",
              i > 0 && "border-t border-border/50",
            )}
          >
            <div className="text-[15px] font-semibold leading-tight text-foreground">
              {n.word}
            </div>
            <div className="mt-1 text-[13px] leading-snug text-muted-foreground">
              {n.note}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export type RepeatingSessionProps = {
  language: Language;
  kindLabel: string;
  eyebrow: string;
  title: string;
  summary?: string | null;
  importance: number;
  topicLabel?: string | null;
  topicIcon?: string | null;
  lines: string[];
  currentLine: number;
  wordNotes?: WordNote[] | null;
  patternQuote?: string | null;
  studyFlag: boolean;
  onToggleStudyFlag: () => void;
  studyNote?: string | null;
  playCount: number;
  sessionCurrent: number;
  sessionTotal: number;
  speed: number;
  onSpeedChange: (v: number) => void;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  onExit: () => void;
};

export function RepeatingSession({
  language,
  kindLabel,
  eyebrow,
  title,
  summary,
  importance,
  topicLabel,
  topicIcon,
  lines,
  currentLine,
  wordNotes,
  patternQuote,
  studyFlag,
  onToggleStudyFlag,
  studyNote,
  playCount,
  sessionCurrent,
  sessionTotal,
  speed,
  onSpeedChange,
  playing,
  onPlay,
  onStop,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  onExit,
}: RepeatingSessionProps) {
  const [showJa, setShowJa] = useState(false);
  const [ja, setJa] = useState<{ key: string; lines: string[] } | null>(null);
  const [jaLoading, setJaLoading] = useState(false);
  const cacheRef = useRef(new Map<string, string[]>());

  const linesKey = lines.join("");

  // 「日本語」ON 時に翻訳 API で各行の和訳を取得（item ごとにキャッシュ）
  useEffect(() => {
    if (!showJa) return;
    const cached = cacheRef.current.get(linesKey);
    if (cached) {
      setJa({ key: linesKey, lines: cached });
      return;
    }
    if (ja?.key === linesKey) return;
    let cancelled = false;
    setJaLoading(true);
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: lines.map(stripSpeaker) }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || `翻訳API エラー (${r.status})`);
        return d as { translations?: string[] };
      })
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d.translations) && d.translations.length > 0) {
          cacheRef.current.set(linesKey, d.translations);
          setJa({ key: linesKey, lines: d.translations });
        } else {
          throw new Error("翻訳結果が空です");
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          toast.error(
            `翻訳エラー: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      })
      .finally(() => {
        if (!cancelled) setJaLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showJa, linesKey]);

  const jaForKey = ja?.key === linesKey ? ja.lines : null;

  // Word Wise はインラインは英語のみ。ベトナム語は会話の右に単語一覧。
  const inlineNotes = language === "en" ? wordNotes : null;
  const sideNotes =
    language === "vi" && wordNotes && wordNotes.length > 0 ? wordNotes : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Header strip — kind label + progress on the left */}
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {kindLabel}リピーティング
        </span>
        <SessionProgress current={sessionCurrent} total={sessionTotal} />
        <span className="text-xs tabular-nums text-muted-foreground">
          <span className="font-bold text-foreground">{sessionCurrent}</span>
          {" / "}
          {sessionTotal} 件
        </span>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
          <CycleRing done={playCount} total={10} />
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {playCount}
            <span className="font-medium text-muted-foreground">/10回</span>
          </span>
        </span>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          終了
        </button>
      </header>

      {/* Stage — vertically centered, compact */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-4">
        {/* Pattern block — plain, no border */}
        <div className="max-w-[680px] text-center">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            <Stars value={importance} />
            <StudyControls
              studyFlag={studyFlag}
              onToggleStudyFlag={onToggleStudyFlag}
              studyNote={studyNote}
            />
          </div>
          {summary && (
            <p className="mx-auto mt-2.5 max-w-[600px] text-sm leading-relaxed text-muted-foreground">
              {summary}
            </p>
          )}
        </div>

        {/* Topic chip — the conversation's genre, right by the conversation */}
        {topicLabel && <TopicChip label={topicLabel} icon={topicIcon ?? null} />}

        {/* Conversation — chat bubbles (stays centered) */}
        <div className="flex w-full max-w-[680px] flex-col gap-3">
          {lines.map((line, i) => (
            <Bubble
              key={i}
              line={line}
              active={i === currentLine}
              showJa={showJa}
              jaText={jaForKey?.[i] ?? null}
              jaLoading={jaLoading}
              patternQuote={patternQuote}
              wordNotes={inlineNotes}
            />
          ))}
        </div>

        {/* VI: word list floats on the right without shifting the conversation */}
        {sideNotes && <WordList notes={sideNotes} />}
      </div>

      {/* Player */}
      <div className="flex justify-center px-6 pb-6 pt-2">
        <div className="inline-flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2.5 shadow-[0_8px_28px_rgba(15,23,42,0.10)]">
          {/* Speed segmented */}
          <div className="inline-flex rounded-full bg-muted p-0.5">
            {SPEEDS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onSpeedChange(v)}
                className={cn(
                  "h-8 min-w-[46px] rounded-full px-2 text-xs font-bold tabular-nums transition-colors",
                  speed === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v.toFixed(1)}×
              </button>
            ))}
          </div>

          <span className="h-7 w-px bg-border" />

          <button
            type="button"
            onClick={onPrev}
            disabled={prevDisabled}
            aria-label="前へ"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={playing ? onStop : onPlay}
            aria-label={playing ? "停止" : "再生"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow-[0_2px_8px_rgba(0,82,204,0.18)] transition-transform active:scale-95"
          >
            {playing ? (
              <Square className="h-5 w-5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            aria-label="次へ"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <span className="h-7 w-px bg-border" />

          <button
            type="button"
            onClick={() => setShowJa((v) => !v)}
            aria-pressed={showJa}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-bold transition-colors",
              showJa
                ? "border-[color:var(--color-primary)] bg-[var(--color-primary)]/8 text-[color:var(--color-primary)]"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Languages className="h-4 w-4" />
            日本語
          </button>
        </div>
      </div>
    </div>
  );
}
