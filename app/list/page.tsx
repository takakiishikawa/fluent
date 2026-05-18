"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  cn,
  DataTable,
  PageHeader,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tag,
  toast,
} from "@takaki/go-design-system";
import type { ColumnDef } from "@tanstack/react-table";
import type { Grammar, Expression, Word } from "@/lib/types";
import { useCurrentLanguage } from "@/lib/language-context";
import { Plus, Star, Trash2, Check, Sparkles } from "lucide-react";
import { ViAddModal } from "@/components/vi-add-modal";
import { CategoryTag } from "@/components/category-tag";
import {
  deleteGrammar,
  deleteExpression,
  deleteWord,
  toggleGrammarPriority,
  toggleExpressionPriority,
  toggleWordPriority,
  setStudyFlag,
  setStudyDone,
  setStudyNote,
  detectPatternQuote,
} from "@/app/actions/practice";

type GrammarWithLesson = Grammar & { lessons: { lesson_no: string } | null };
type ExpressionWithLesson = Expression & {
  lessons: { lesson_no: string } | null;
};

function StarRating({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= value ? "fill-[var(--color-warning)] text-[color:var(--color-warning)]" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function PriorityToggle({
  active,
  onClick,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={active ? "強化を外す" : "強化に追加"}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-50",
        active
          ? "text-[color:var(--color-warning)] hover:bg-[color:var(--color-warning)]/10"
          : "text-muted-foreground/40 hover:text-[color:var(--color-warning)] hover:bg-muted",
      )}
    >
      <Star
        className={cn("h-4 w-4", active && "fill-[var(--color-warning)]")}
      />
    </button>
  );
}

function sortItems<
  T extends {
    is_priority: boolean;
    play_count: number;
    lessons?: { lesson_no: string } | null;
    created_at: string;
  },
>(items: T[]): T[] {
  // 強化フラグ ON で play_count < 10 のものを先頭に。それ以外は従来の lesson_no 順
  // （lesson_no が無いものは created_at 古い順）
  return [...items].sort((a, b) => {
    const aBoost = a.is_priority && a.play_count < 10 ? 1 : 0;
    const bBoost = b.is_priority && b.play_count < 10 ? 1 : 0;
    if (aBoost !== bBoost) return bBoost - aBoost;

    const aN = a.lessons?.lesson_no ?? "";
    const bN = b.lessons?.lesson_no ?? "";
    if (aN && bN) {
      const ap = aN.split("-").map(Number);
      const bp = bN.split("-").map(Number);
      for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        const diff = (ap[i] ?? 0) - (bp[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

function PlayCountStatusSummary({
  items,
}: {
  items: { play_count: number; is_priority: boolean }[];
}) {
  let done = 0;
  let inProgress = 0;
  let boost = 0;
  for (const it of items) {
    if (it.play_count >= 10) done++;
    else inProgress++;
    if (it.is_priority && it.play_count < 10) boost++;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag color="success">習得済み {done}</Tag>
      <Tag color="warning">練習中 {inProgress}</Tag>
      {boost > 0 && <Tag color="info">強化 {boost}</Tag>}
    </div>
  );
}

function PlayCount({ count, max = 10 }: { count: number; max?: number }) {
  if (count >= max) {
    return (
      <Badge className="border-transparent bg-[color:var(--color-success-subtle)] text-[color:var(--color-success)]">
        完了
      </Badge>
    );
  }
  return (
    <span className="text-xs text-foreground tabular-nums">
      {count}/{max}
    </span>
  );
}

// ── GrammarTab ────────────────────────────────────────────────────────────────

function GrammarTab({
  reloadKey,
  bumpReload,
  onCountChange,
}: {
  reloadKey: number;
  bumpReload: () => void;
  onCountChange?: (n: number) => void;
}) {
  const supabase = createClient();
  const language = useCurrentLanguage();
  const isVi = language === "vi";
  const [items, setItems] = useState<GrammarWithLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("grammar")
        .select("*, lessons(lesson_no)")
        .eq("language", language);
      const sorted = sortItems((data ?? []) as GrammarWithLesson[]);
      setItems(sorted);
      onCountChange?.(sorted.length);
      setLoading(false);
    }
    load();
  }, [language, reloadKey]);

  async function handleDelete(row: GrammarWithLesson) {
    if (!confirm(`「${row.name}」を削除しますか？`)) return;
    setBusyId(row.id);
    try {
      await deleteGrammar(row.id);
      toast.success("削除しました");
      bumpReload();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePriority(row: GrammarWithLesson) {
    const next = !row.is_priority;
    setBusyId(row.id);
    setItems((prev) =>
      prev.map((it) => (it.id === row.id ? { ...it, is_priority: next } : it)),
    );
    try {
      await toggleGrammarPriority(row.id, next);
    } catch {
      toast.error("更新に失敗しました");
      // 失敗時は元に戻す
      setItems((prev) =>
        prev.map((it) =>
          it.id === row.id ? { ...it, is_priority: !next } : it,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  const columns = useMemo(
    (): ColumnDef<GrammarWithLesson>[] => {
      const cols: ColumnDef<GrammarWithLesson>[] = [
        {
          id: "row_id",
          header: "ID",
          cell: ({ row }) => (
            <span className="font-mono text-xs text-foreground tabular-nums">
              {row.index + 1}
            </span>
          ),
        },
      ];
      if (!isVi) {
        cols.push({
          id: "lesson_no",
          header: "テキスト",
          cell: ({ row }) => (
            <span className="font-mono text-xs text-foreground">
              {row.original.lessons?.lesson_no ?? "—"}
            </span>
          ),
        });
      }
      cols.push({
        id: "category",
        header: "カテゴリ",
        cell: ({ row }) => <CategoryTag category={row.original.category} />,
      });
      cols.push(
        {
          accessorKey: "name",
          header: "文法名",
          cell: ({ row }) => (
            <span className="font-medium text-foreground">
              {row.original.name}
            </span>
          ),
        },
        {
          accessorKey: "summary",
          header: "概要",
          cell: ({ row }) => (
            <span className="text-sm text-foreground line-clamp-1 max-w-xs block">
              {row.original.summary?.replace(/\\n/g, " ").split("\n")[0]}
            </span>
          ),
        },
      );
      if (isVi) {
        cols.push({
          id: "source_title",
          header: "ソース",
          cell: ({ row }) => (
            <span className="text-xs text-muted-foreground line-clamp-1 max-w-[160px] block">
              {row.original.source_title ?? "—"}
            </span>
          ),
        });
      }
      cols.push(
        {
          accessorKey: "frequency",
          header: "頻度",
          cell: ({ row }) => <StarRating value={row.original.frequency} />,
        },
        {
          accessorKey: "play_count",
          header: "練習",
          cell: ({ row }) => <PlayCount count={row.original.play_count} />,
        },
        {
          id: "is_priority",
          header: "強化",
          cell: ({ row }) => (
            <PriorityToggle
              active={row.original.is_priority}
              onClick={() => handleTogglePriority(row.original)}
              disabled={busyId === row.original.id}
            />
          ),
        },
        {
          id: "actions",
          header: "",
          cell: ({ row }) => (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(row.original)}
              disabled={busyId === row.original.id}
              aria-label="削除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ),
        },
      );
      return cols;
    },
    [isVi, busyId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PlayCountStatusSummary items={items} />
      <DataTable
        columns={columns}
        data={items}
        pageSize={100}
        pageSizeOptions={[100]}
        emptyMessage="文法が登録されていません"
      />
    </div>
  );
}

// ── PhraseTab ─────────────────────────────────────────────────────────────────

function PhraseTab({
  reloadKey,
  bumpReload,
  onCountChange,
}: {
  reloadKey: number;
  bumpReload: () => void;
  onCountChange?: (n: number) => void;
}) {
  const supabase = createClient();
  const language = useCurrentLanguage();
  const isVi = language === "vi";
  const [items, setItems] = useState<ExpressionWithLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("expressions")
        .select("*, lessons(lesson_no)")
        .eq("language", language);
      const sorted = sortItems((data ?? []) as ExpressionWithLesson[]);
      setItems(sorted);
      onCountChange?.(sorted.length);
      setLoading(false);
    }
    load();
  }, [language, reloadKey]);

  async function handleDelete(row: ExpressionWithLesson) {
    if (!confirm(`「${row.expression}」を削除しますか？`)) return;
    setBusyId(row.id);
    try {
      await deleteExpression(row.id);
      toast.success("削除しました");
      bumpReload();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePriority(row: ExpressionWithLesson) {
    const next = !row.is_priority;
    setBusyId(row.id);
    setItems((prev) =>
      prev.map((it) => (it.id === row.id ? { ...it, is_priority: next } : it)),
    );
    try {
      await toggleExpressionPriority(row.id, next);
    } catch {
      toast.error("更新に失敗しました");
      setItems((prev) =>
        prev.map((it) =>
          it.id === row.id ? { ...it, is_priority: !next } : it,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  const columns = useMemo(
    (): ColumnDef<ExpressionWithLesson>[] => {
      const cols: ColumnDef<ExpressionWithLesson>[] = [
        {
          id: "row_id",
          header: "ID",
          cell: ({ row }) => (
            <span className="font-mono text-xs text-foreground tabular-nums">
              {row.index + 1}
            </span>
          ),
        },
      ];
      if (!isVi) {
        cols.push({
          id: "lesson_no",
          header: "テキスト",
          cell: ({ row }) => (
            <span className="font-mono text-xs text-foreground">
              {row.original.lessons?.lesson_no ?? "—"}
            </span>
          ),
        });
      }
      cols.push(
        {
          accessorKey: "category",
          header: "カテゴリ",
          cell: ({ row }) => <CategoryTag category={row.original.category} />,
        },
        {
          accessorKey: "expression",
          header: "フレーズ",
          cell: ({ row }) => (
            <span className="font-medium text-foreground">
              {row.original.expression}
            </span>
          ),
        },
        {
          accessorKey: "meaning",
          header: "意味",
          cell: ({ row }) => (
            <span className="text-sm text-foreground line-clamp-1 max-w-xs block">
              {row.original.meaning}
            </span>
          ),
        },
      );
      if (isVi) {
        cols.push({
          id: "source_title",
          header: "ソース",
          cell: ({ row }) => (
            <span className="text-xs text-muted-foreground line-clamp-1 max-w-[160px] block">
              {row.original.source_title ?? "—"}
            </span>
          ),
        });
      }
      cols.push(
        {
          accessorKey: "frequency",
          header: "頻度",
          cell: ({ row }) => <StarRating value={row.original.frequency} />,
        },
        {
          accessorKey: "play_count",
          header: "練習",
          cell: ({ row }) => <PlayCount count={row.original.play_count} />,
        },
        {
          id: "is_priority",
          header: "強化",
          cell: ({ row }) => (
            <PriorityToggle
              active={row.original.is_priority}
              onClick={() => handleTogglePriority(row.original)}
              disabled={busyId === row.original.id}
            />
          ),
        },
        {
          id: "actions",
          header: "",
          cell: ({ row }) => (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(row.original)}
              disabled={busyId === row.original.id}
              aria-label="削除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ),
        },
      );
      return cols;
    },
    [isVi, busyId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PlayCountStatusSummary items={items} />
      <DataTable
        columns={columns}
        data={items}
        pageSize={100}
        pageSizeOptions={[100]}
        emptyMessage="フレーズが登録されていません"
      />
    </div>
  );
}

// ── WordTab ───────────────────────────────────────────────────────────────────

function WordTab({
  reloadKey,
  bumpReload,
  onCountChange,
}: {
  reloadKey: number;
  bumpReload: () => void;
  onCountChange?: (n: number) => void;
}) {
  const supabase = createClient();
  const language = useCurrentLanguage();
  const [items, setItems] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("words")
        .select("*")
        .eq("language", language);
      const sorted = sortItems(
        ((data ?? []) as Word[]).map((w) => ({ ...w, lessons: null })),
      ) as Word[];
      setItems(sorted);
      onCountChange?.(sorted.length);
      setLoading(false);
    }
    load();
  }, [language, reloadKey]);

  async function handleDelete(row: Word) {
    if (!confirm(`「${row.word}」を削除しますか？`)) return;
    setBusyId(row.id);
    try {
      await deleteWord(row.id);
      toast.success("削除しました");
      bumpReload();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePriority(row: Word) {
    const next = !row.is_priority;
    setBusyId(row.id);
    setItems((prev) =>
      prev.map((it) => (it.id === row.id ? { ...it, is_priority: next } : it)),
    );
    try {
      await toggleWordPriority(row.id, next);
    } catch {
      toast.error("更新に失敗しました");
      setItems((prev) =>
        prev.map((it) =>
          it.id === row.id ? { ...it, is_priority: !next } : it,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  const columns = useMemo(
    (): ColumnDef<Word>[] => [
      {
        id: "row_id",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground tabular-nums">
            {row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: "カテゴリ",
        cell: ({ row }) => <CategoryTag category={row.original.category} />,
      },
      {
        accessorKey: "word",
        header: "単語",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.word}
          </span>
        ),
      },
      {
        accessorKey: "meaning",
        header: "意味",
        cell: ({ row }) => (
          <span className="text-sm text-foreground line-clamp-1 max-w-xs block">
            {row.original.meaning}
          </span>
        ),
      },
      {
        id: "source_title",
        header: "ソース",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[160px] block">
            {row.original.source_title ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "frequency",
        header: "頻度",
        cell: ({ row }) => <StarRating value={row.original.frequency} />,
      },
      {
        accessorKey: "play_count",
        header: "練習",
        cell: ({ row }) => <PlayCount count={row.original.play_count} />,
      },
      {
        id: "is_priority",
        header: "強化",
        cell: ({ row }) => (
          <PriorityToggle
            active={row.original.is_priority}
            onClick={() => handleTogglePriority(row.original)}
            disabled={busyId === row.original.id}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => handleDelete(row.original)}
            disabled={busyId === row.original.id}
            aria-label="削除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [busyId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PlayCountStatusSummary items={items} />
      <DataTable
        columns={columns}
        data={items}
        pageSize={100}
        pageSizeOptions={[100]}
        emptyMessage="単語が登録されていません"
      />
    </div>
  );
}

// ── StudyTab（学習したいリスト） ───────────────────────────────────────────────

type StudyKindT = "grammar" | "expression" | "word";

type StudyItem = {
  kind: StudyKindT;
  id: string;
  title: string;
  sub: string;
  study_done: boolean;
  study_note: string | null;
};

const STUDY_KIND_LABEL: Record<StudyKindT, string> = {
  grammar: "文法",
  expression: "フレーズ",
  word: "単語",
};

function StudyTab({
  reloadKey,
  onCountChange,
}: {
  reloadKey: number;
  onCountChange?: (n: number) => void;
}) {
  const supabase = createClient();
  const language = useCurrentLanguage();
  const [items, setItems] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [g, e, w] = await Promise.all([
        supabase
          .from("grammar")
          .select("id, name, summary, study_done, study_note")
          .eq("language", language)
          .eq("study_flag", true),
        supabase
          .from("expressions")
          .select("id, expression, meaning, study_done, study_note")
          .eq("language", language)
          .eq("study_flag", true),
        supabase
          .from("words")
          .select("id, word, meaning, study_done, study_note")
          .eq("language", language)
          .eq("study_flag", true),
      ]);
      type Row = { id: string; study_done: boolean; study_note: string | null };
      const list: StudyItem[] = [
        ...((g.data ?? []) as (Row & {
          name: string;
          summary: string | null;
        })[]).map((r) => ({
          kind: "grammar" as const,
          id: r.id,
          title: r.name,
          sub: (r.summary ?? "").replace(/\\n/g, " "),
          study_done: r.study_done,
          study_note: r.study_note,
        })),
        ...((e.data ?? []) as (Row & {
          expression: string;
          meaning: string;
        })[]).map((r) => ({
          kind: "expression" as const,
          id: r.id,
          title: r.expression,
          sub: r.meaning ?? "",
          study_done: r.study_done,
          study_note: r.study_note,
        })),
        ...((w.data ?? []) as (Row & {
          word: string;
          meaning: string;
        })[]).map((r) => ({
          kind: "word" as const,
          id: r.id,
          title: r.word,
          sub: r.meaning ?? "",
          study_done: r.study_done,
          study_note: r.study_note,
        })),
      ];
      list.sort((a, b) => Number(a.study_done) - Number(b.study_done));
      setItems(list);
      onCountChange?.(list.length);
      setLoading(false);
    }
    load();
  }, [language, reloadKey]);

  async function toggleDone(item: StudyItem) {
    const next = !item.study_done;
    setItems((prev) =>
      [...prev.map((it) => (it.id === item.id ? { ...it, study_done: next } : it))].sort(
        (a, b) => Number(a.study_done) - Number(b.study_done),
      ),
    );
    try {
      await setStudyDone(item.kind, item.id, next);
    } catch {
      toast.error("更新に失敗しました");
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, study_done: !next } : it,
        ),
      );
    }
  }

  async function saveNote(item: StudyItem, note: string) {
    if (note === (item.study_note ?? "")) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, study_note: note || null } : it,
      ),
    );
    try {
      await setStudyNote(item.kind, item.id, note);
    } catch {
      toast.error("メモの保存に失敗しました");
    }
  }

  async function removeItem(item: StudyItem) {
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    onCountChange?.(items.length - 1);
    try {
      await setStudyFlag(item.kind, item.id, false);
    } catch {
      toast.error("削除に失敗しました");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          学習したいリストは空です
        </p>
        <p className="text-xs text-muted-foreground">
          リピーティング中にフラグを立てるとここに表示されます
        </p>
      </div>
    );
  }

  const doneCount = items.filter((it) => it.study_done).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tag color="info">学習したい {items.length}</Tag>
        <Tag color="success">完了 {doneCount}</Tag>
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "rounded-lg border border-border p-4 transition-opacity",
              item.study_done && "opacity-60",
            )}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleDone(item)}
                aria-label={item.study_done ? "完了を外す" : "完了にする"}
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                  item.study_done
                    ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white"
                    : "border-border text-transparent hover:border-[color:var(--color-success)]",
                )}
              >
                <Check className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Tag color="info">{STUDY_KIND_LABEL[item.kind]}</Tag>
                  <span
                    className={cn(
                      "font-medium text-foreground",
                      item.study_done && "line-through",
                    )}
                  >
                    {item.title}
                  </span>
                </div>
                {item.sub && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {item.sub}
                  </p>
                )}
                <textarea
                  defaultValue={item.study_note ?? ""}
                  onBlur={(e) => saveNote(item, e.target.value.trim())}
                  placeholder="外部で学習したことをメモ…"
                  rows={2}
                  className="mt-2 w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(item)}
                aria-label="リストから外す"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ListPage() {
  const language = useCurrentLanguage();
  const isVi = language === "vi";
  const [grammarCount, setGrammarCount] = useState<number | null>(null);
  const [phraseCount, setPhraseCount] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [studyCount, setStudyCount] = useState<number | null>(null);
  const [patternMissing, setPatternMissing] = useState<number | null>(null);
  const [patternBusy, setPatternBusy] = useState(false);
  const [patternProgress, setPatternProgress] = useState({ done: 0, total: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const bumpReload = useCallback(() => setReloadKey((k) => k + 1), []);

  const reloadCounts = useCallback(() => {
    const supabase = createClient();
    const studyCountQuery = (table: string) =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("language", language)
        .eq("study_flag", true);
    // 練習完了（play_count >= 10）の項目はリピート対象外なので判定不要
    const missingPatternQuery = (table: string) =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("language", language)
        .is("pattern_quote", null)
        .lt("play_count", 10);
    Promise.all([
      supabase
        .from("grammar")
        .select("id", { count: "exact", head: true })
        .eq("language", language),
      supabase
        .from("expressions")
        .select("id", { count: "exact", head: true })
        .eq("language", language),
      supabase
        .from("words")
        .select("id", { count: "exact", head: true })
        .eq("language", language),
      studyCountQuery("grammar"),
      studyCountQuery("expressions"),
      studyCountQuery("words"),
      missingPatternQuery("grammar"),
      missingPatternQuery("expressions"),
    ]).then(([g, e, w, gs, es, ws, gp, ep]) => {
      setGrammarCount(g.count ?? 0);
      setPhraseCount(e.count ?? 0);
      setWordCount(w.count ?? 0);
      setStudyCount((gs.count ?? 0) + (es.count ?? 0) + (ws.count ?? 0));
      setPatternMissing((gp.count ?? 0) + (ep.count ?? 0));
    });
  }, [language]);

  async function handleDetectPatterns() {
    setPatternBusy(true);
    const supabase = createClient();
    try {
      const [g, e] = await Promise.all([
        supabase
          .from("grammar")
          .select("id")
          .eq("language", language)
          .is("pattern_quote", null)
          .lt("play_count", 10)
          .limit(100),
        supabase
          .from("expressions")
          .select("id")
          .eq("language", language)
          .is("pattern_quote", null)
          .lt("play_count", 10)
          .limit(100),
      ]);
      type Task = { kind: "grammar" | "expression"; id: string };
      const tasks: Task[] = [
        ...((g.data ?? []) as { id: string }[]).map((r) => ({
          kind: "grammar" as const,
          id: r.id,
        })),
        ...((e.data ?? []) as { id: string }[]).map((r) => ({
          kind: "expression" as const,
          id: r.id,
        })),
      ].slice(0, 100);
      if (tasks.length === 0) {
        toast.info("判定対象がありません");
        return;
      }
      setPatternProgress({ done: 0, total: tasks.length });
      const BATCH = 3;
      let ok = 0;
      let fail = 0;
      for (let i = 0; i < tasks.length; i += BATCH) {
        const batch = tasks.slice(i, i + BATCH);
        const res = await Promise.allSettled(
          batch.map((t) => detectPatternQuote(t.kind, t.id)),
        );
        ok += res.filter((r) => r.status === "fulfilled").length;
        fail += res.filter((r) => r.status === "rejected").length;
        setPatternProgress({
          done: Math.min(i + batch.length, tasks.length),
          total: tasks.length,
        });
      }
      if (fail === 0) toast.success(`${ok}件のパターンを判定しました`);
      else toast.error(`判定完了: ${ok}件成功 / ${fail}件失敗`);
      bumpReload();
    } finally {
      setPatternBusy(false);
      setPatternProgress({ done: 0, total: 0 });
    }
  }

  useEffect(() => {
    reloadCounts();
  }, [reloadCounts, reloadKey]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ライブラリ"
        actions={
          <div className="flex items-center gap-2">
            {patternBusy && (
              <span className="text-sm text-muted-foreground tabular-nums">
                パターン判定中 {patternProgress.done} / {patternProgress.total}
              </span>
            )}
            {!patternBusy && !!patternMissing && (
              <Button
                variant="outline"
                onClick={handleDetectPatterns}
                title="会話内の文法・フレーズの該当箇所を AI で判定（100件ずつ）"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                パターン判定（残り{patternMissing}）
              </Button>
            )}
            {isVi && (
              <Button
                onClick={() => setShowAddModal(true)}
                disabled={patternBusy}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                追加
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="grammar">
        <TabsList>
          <TabsTrigger value="grammar">
            文法
            {grammarCount !== null && (
              <Badge variant="secondary" className="ml-2 rounded-full">
                {grammarCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="phrase">
            フレーズ
            {phraseCount !== null && (
              <Badge variant="secondary" className="ml-2 rounded-full">
                {phraseCount}
              </Badge>
            )}
          </TabsTrigger>
          {isVi && (
            <TabsTrigger value="word">
              単語
              {wordCount !== null && (
                <Badge variant="secondary" className="ml-2 rounded-full">
                  {wordCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="study">
            学習したい
            {studyCount !== null && studyCount > 0 && (
              <Badge variant="secondary" className="ml-2 rounded-full">
                {studyCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="grammar" className="mt-4">
          <GrammarTab
            reloadKey={reloadKey}
            bumpReload={bumpReload}
            onCountChange={setGrammarCount}
          />
        </TabsContent>
        <TabsContent value="phrase" className="mt-4">
          <PhraseTab
            reloadKey={reloadKey}
            bumpReload={bumpReload}
            onCountChange={setPhraseCount}
          />
        </TabsContent>
        {isVi && (
          <TabsContent value="word" className="mt-4">
            <WordTab
              reloadKey={reloadKey}
              bumpReload={bumpReload}
              onCountChange={setWordCount}
            />
          </TabsContent>
        )}
        <TabsContent value="study" className="mt-4">
          <StudyTab reloadKey={reloadKey} onCountChange={setStudyCount} />
        </TabsContent>
      </Tabs>

      {showAddModal && (
        <ViAddModal
          onClose={() => setShowAddModal(false)}
          onSaved={bumpReload}
        />
      )}
    </div>
  );
}
