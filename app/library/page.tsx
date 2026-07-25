"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input, Switch, toast } from "@takaki/go-design-system";
import { Lock, Check, SkipForward } from "lucide-react";
import {
  toggleRound,
  masterItem,
  setGrammarRoundExample,
} from "@/app/actions/practice";
import { useCurrentLanguage } from "@/lib/language-context";

type Round = 1 | 2 | 3;

type Row = {
  id: string;
  no: number;
  title: string;
  jp: string;
  examples: [string, string, string];
  rounds: [boolean, boolean, boolean];
};

function useGrammarItems(reloadKey: number) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("grammar")
        .select("*, lessons(lesson_no)")
        .eq("language", "en");
      if (cancelled) return;
      const sorted = [...(data ?? [])].sort((a, b) => {
        const an = a.lessons?.lesson_no ?? "";
        const bn = b.lessons?.lesson_no ?? "";
        return an.localeCompare(bn, undefined, { numeric: true });
      });
      setItems(
        sorted.map((r, i) => ({
          id: r.id,
          no: i + 1,
          title: r.name,
          jp: r.summary ?? "",
          examples: [
            r.round1_example ?? "",
            r.round2_example ?? "",
            r.round3_example ?? "",
          ],
          rounds: [!!r.round1_done, !!r.round2_done, !!r.round3_done],
        })),
      );
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, supabase]);

  return { items, setItems, loading };
}

function ExampleInput({
  value,
  registerRef,
  disabled,
  onChange,
  onCommit,
}: {
  value: string;
  registerRef: (el: HTMLInputElement | null) => void;
  disabled?: boolean;
  onChange: (text: string) => void;
  onCommit: (advanceFocus: boolean) => void;
}) {
  return (
    <Input
      ref={registerRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(true);
        }
      }}
      onBlur={() => onCommit(false)}
      disabled={disabled}
      placeholder="Write your own example sentence…"
      className="text-[13px]"
      style={{ background: "var(--color-background)" }}
    />
  );
}

function InputTable({
  round,
  showCompleted,
  items,
  setItems,
  loading,
  reload,
}: {
  round: Round;
  showCompleted: boolean;
  items: Row[];
  setItems: React.Dispatch<React.SetStateAction<Row[]>>;
  loading: boolean;
  reload: () => void;
}) {
  const roundIdx = round - 1;
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  // このラウンドで未保存の入力中テキスト（ラウンドが変わったらリセットする）
  const [draftText, setDraftText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDraftText({});
  }, [round]);

  const visible = showCompleted
    ? items
    : items.filter((it) => !it.rounds[roundIdx]);

  useEffect(() => {
    if (!pendingFocusId) return;
    const el = inputRefs.current.get(pendingFocusId);
    if (el) {
      el.focus();
      setPendingFocusId(null);
    } else if (!visible.some((it) => it.id === pendingFocusId)) {
      setPendingFocusId(null);
    }
  }, [pendingFocusId, visible]);

  function textFor(row: Row): string {
    return draftText[row.id] ?? row.examples[roundIdx] ?? "";
  }

  function isDirty(row: Row): boolean {
    const draft = draftText[row.id];
    return draft !== undefined && draft !== (row.examples[roundIdx] ?? "");
  }

  async function handleMaster(row: Row) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== row.id) return it;
        const rounds = [...it.rounds] as [boolean, boolean, boolean];
        for (let r = roundIdx; r < 3; r++) rounds[r] = true;
        return { ...it, rounds };
      }),
    );
    try {
      await masterItem("grammar", row.id, round);
    } catch {
      reload();
    }
  }

  async function handleCommit(row: Row, advanceFocus: boolean) {
    if (!isDirty(row)) {
      if (advanceFocus) focusNext(row);
      return;
    }
    const trimmed = textFor(row).trim();
    const done = trimmed.length > 0;
    const wasDone = row.rounds[roundIdx];

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== row.id) return it;
        const examples = [...it.examples] as [string, string, string];
        examples[roundIdx] = trimmed;
        const rounds = [...it.rounds] as [boolean, boolean, boolean];
        rounds[roundIdx] = done;
        return { ...it, examples, rounds };
      }),
    );
    setDraftText((prev) => {
      const rest = { ...prev };
      delete rest[row.id];
      return rest;
    });
    setSaving((prev) => ({ ...prev, [row.id]: true }));
    try {
      await setGrammarRoundExample(row.id, round, trimmed);
      if (wasDone !== done) {
        await toggleRound("grammar", row.id, round, done);
      }
      if (advanceFocus) focusNext(row);
    } catch {
      toast.error("Failed to save example");
      reload();
    } finally {
      setSaving((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  function focusNext(row: Row) {
    if (showCompleted) return;
    const index = visible.findIndex((it) => it.id === row.id);
    const next = index >= 0 ? visible[index + 1] : undefined;
    setPendingFocusId(next ? next.id : null);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div
      className="rounded-[20px]"
      style={{ border: "1px solid var(--color-border-default)", background: "var(--color-surface)" }}
    >
      <div
        className="sticky top-0 z-10 flex items-center gap-4 rounded-t-[20px] px-[18px] py-2.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground"
        style={{ background: "var(--color-surface-subtle)" }}
      >
        <div className="w-[28px] shrink-0">No.</div>
        <div className="flex-1">Grammar point</div>
        <div className="w-[380px] shrink-0">Write your own example</div>
      </div>
      <div className="overflow-hidden rounded-b-[20px]">
        {visible.length === 0 ? (
          <div className="px-[18px] py-10 text-center text-sm text-muted-foreground">
            No items
          </div>
        ) : (
          visible.map((row) => {
            const locked = roundIdx > 0 && !row.rounds.slice(0, roundIdx).every(Boolean);
            const checked = textFor(row).trim().length > 0;
            const canSkipAhead = !locked && !checked && round < 3;
            const contentOpacity = locked ? 0.35 : checked ? 0.55 : 1;
            return (
              <div
                key={row.id}
                className="relative flex items-start gap-4 px-[18px] py-3.5"
                style={{
                  borderTop: "1px solid var(--color-border-default)",
                  borderLeft: `2px solid ${checked ? "var(--color-primary)" : "transparent"}`,
                }}
              >
                <div
                  className="w-[28px] shrink-0 pt-0.5 text-[13px] text-foreground"
                  style={{ opacity: contentOpacity }}
                >
                  {row.no}
                </div>
                <div className="min-w-0 flex-1" style={{ opacity: contentOpacity }}>
                  <div className="flex items-start gap-2">
                    <div className="text-[14px] font-semibold text-foreground">
                      {row.title}
                    </div>
                    {checked && (
                      <Check
                        className="mt-[3px] h-3.5 w-3.5 shrink-0"
                        strokeWidth={3}
                        style={{ color: "var(--color-primary)" }}
                      />
                    )}
                  </div>
                  <div className="whitespace-pre-line text-[12.5px] leading-snug text-muted-foreground">
                    {row.jp.replace(/\\n/g, "\n")}
                  </div>
                </div>

                <div className="w-[380px] shrink-0" style={{ opacity: locked ? 0.35 : 1 }}>
                  {!locked && (
                    <ExampleInput
                      value={textFor(row)}
                      disabled={!!saving[row.id]}
                      registerRef={(el) => {
                        if (el) inputRefs.current.set(row.id, el);
                        else inputRefs.current.delete(row.id);
                      }}
                      onChange={(text) =>
                        setDraftText((prev) => ({ ...prev, [row.id]: text }))
                      }
                      onCommit={(advanceFocus) => handleCommit(row, advanceFocus)}
                    />
                  )}
                </div>

                {canSkipAhead && (
                  <button
                    onClick={() => handleMaster(row)}
                    title="Mark fully understood — skip remaining rounds"
                    className="flex shrink-0 items-center gap-1 self-center rounded-full px-2.5 py-1.5 text-[11px] font-semibold"
                    style={{
                      color: "var(--color-accent)",
                      background: "var(--color-accent-soft)",
                    }}
                  >
                    <SkipForward className="h-3 w-3" />
                    Skip
                  </button>
                )}

                {locked && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-default)" }}
                    >
                      <Lock className="h-3.5 w-3.5" style={{ color: "var(--color-text-secondary)" }} />
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function LibraryInputPage() {
  const language = useCurrentLanguage();
  const router = useRouter();
  const [round, setRound] = useState<Round>(1);
  const [showCompleted, setShowCompleted] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { items, setItems, loading } = useGrammarItems(reloadKey);

  useEffect(() => {
    if (language === "vi") router.replace("/list");
  }, [language, router]);

  if (language === "vi") return null;

  const roundCounts = ([1, 2, 3] as Round[]).map(
    (r) => items.filter((it) => it.rounds[r - 1]).length,
  );

  return (
    <div className="w-full max-w-[980px]">
      <div
        className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--color-accent)" }}
      >
        Input
      </div>

      <div
        className="mb-[22px] flex flex-wrap items-center gap-[22px]"
        style={{ borderBottom: "1px solid var(--color-border-default)" }}
      >
        {([1, 2, 3] as Round[]).map((r) => (
          <button
            key={r}
            onClick={() => setRound(r)}
            className="flex items-baseline gap-1.5 pb-2 pt-2 text-[14px] font-semibold transition-colors"
            style={{
              color: round === r ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              borderBottom: round === r ? "2px solid var(--color-primary)" : "2px solid transparent",
            }}
          >
            Round {r}
            <span className="text-[12px] font-medium text-muted-foreground">
              ({roundCounts[r - 1]}/{items.length})
            </span>
          </button>
        ))}
        <label className="mb-2 ml-auto flex shrink-0 items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
          Show completed
          <Switch checked={showCompleted} onCheckedChange={setShowCompleted} />
        </label>
      </div>

      <InputTable
        round={round}
        showCompleted={showCompleted}
        items={items}
        setItems={setItems}
        loading={loading}
        reload={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
