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
import { Plus, Star, Trash2, Sparkles } from "lucide-react";
import { ViAddModal } from "@/components/vi-add-modal";
import { SceneTag } from "@/components/scene-tag";
import {
  deleteGrammar,
  deleteExpression,
  deleteWord,
  detectPatternQuote,
} from "@/app/actions/practice";

type GrammarWithLesson = Grammar & { lessons: { lesson_no: string } | null };
type ExpressionWithLesson = Expression & {
  lessons: { lesson_no: string } | null;
};

/** 登録済みの場面（category）を重複なく集めて場面タグの候補にする */
function useSceneSuggestions(items: { category: string | null }[]): string[] {
  return useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((i) => i.category?.trim())
            .filter((c): c is string => !!c),
        ),
      ).sort((a, b) => a.localeCompare(b, "ja")),
    [items],
  );
}

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

function sortItems<
  T extends {
    lessons?: { lesson_no: string } | null;
    created_at: string;
  },
>(items: T[]): T[] {
  // lesson_no 順（lesson_no が無いものは created_at 古い順）
  return [...items].sort((a, b) => {
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
  items: { play_count: number }[];
}) {
  let done = 0;
  let inProgress = 0;
  for (const it of items) {
    if (it.play_count >= 10) done++;
    else inProgress++;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag color="success">習得済み {done}</Tag>
      <Tag color="warning">練習中 {inProgress}</Tag>
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

  const suggestions = useSceneSuggestions(items);
  const handleSceneChanged = useCallback(
    (id: string, next: string | null) =>
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, category: next } : it)),
      ),
    [],
  );

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
        header: isVi ? "場面" : "カテゴリ",
        cell: ({ row }) => (
          <SceneTag
            kind="grammar"
            id={row.original.id}
            value={row.original.category}
            suggestions={suggestions}
            onChanged={(next) => handleSceneChanged(row.original.id, next)}
          />
        ),
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
    [isVi, busyId, suggestions, handleSceneChanged],
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

  const suggestions = useSceneSuggestions(items);
  const handleSceneChanged = useCallback(
    (id: string, next: string | null) =>
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, category: next } : it)),
      ),
    [],
  );

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
          header: isVi ? "場面" : "カテゴリ",
          cell: ({ row }) => (
            <SceneTag
              kind="expression"
              id={row.original.id}
              value={row.original.category}
              suggestions={suggestions}
              onChanged={(next) => handleSceneChanged(row.original.id, next)}
            />
          ),
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
    [isVi, busyId, suggestions, handleSceneChanged],
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

  const suggestions = useSceneSuggestions(items);
  const handleSceneChanged = useCallback(
    (id: string, next: string | null) =>
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, category: next } : it)),
      ),
    [],
  );

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
        header: "場面",
        cell: ({ row }) => (
          <SceneTag
            kind="word"
            id={row.original.id}
            value={row.original.category}
            suggestions={suggestions}
            onChanged={(next) => handleSceneChanged(row.original.id, next)}
          />
        ),
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
    [busyId, suggestions, handleSceneChanged],
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ListPage() {
  const language = useCurrentLanguage();
  const isVi = language === "vi";
  const [grammarCount, setGrammarCount] = useState<number | null>(null);
  const [phraseCount, setPhraseCount] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [patternMissing, setPatternMissing] = useState<number | null>(null);
  const [patternBusy, setPatternBusy] = useState(false);
  const [patternProgress, setPatternProgress] = useState({ done: 0, total: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const bumpReload = useCallback(() => setReloadKey((k) => k + 1), []);

  const reloadCounts = useCallback(() => {
    const supabase = createClient();
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
      missingPatternQuery("grammar"),
      missingPatternQuery("expressions"),
    ]).then(([g, e, w, gp, ep]) => {
      setGrammarCount(g.count ?? 0);
      setPhraseCount(e.count ?? 0);
      setWordCount(w.count ?? 0);
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
