"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input, Switch, toast } from "@takaki/go-design-system";
import { Lock, Check, SkipForward } from "lucide-react";
import { toggleRound, masterItem, setItemNote } from "@/app/actions/practice";
import { useCurrentLanguage } from "@/lib/language-context";

type Kind = "grammar" | "expression";
type Round = 1 | 2 | 3;

type Row = {
  id: string;
  no: number;
  title: string;
  jp: string;
  note: string | null;
  rounds: [boolean, boolean, boolean];
};

function useLibraryItems(kind: Kind, reloadKey: number) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const table = kind === "grammar" ? "grammar" : "expressions";
      const { data } = await supabase
        .from(table)
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
          title: kind === "grammar" ? r.name : r.expression,
          jp: (kind === "grammar" ? r.summary : r.meaning) ?? "",
          note: r.note ?? null,
          rounds: [!!r.round1_done, !!r.round2_done, !!r.round3_done],
        })),
      );
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [kind, reloadKey, supabase]);

  return { items, setItems, loading };
}

function ExampleInput({
  kind,
  row,
  registerRef,
  onSubmit,
}: {
  kind: Kind;
  row: Row;
  registerRef: (id: string, el: HTMLInputElement | null) => void;
  onSubmit: (row: Row, text: string) => void;
}) {
  const [value, setValue] = useState(row.note ?? "");
  const [saving, setSaving] = useState(false);

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await setItemNote(kind, row.id, trimmed);
      onSubmit(row, trimmed);
      setValue("");
    } catch {
      toast.error("Failed to save example");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Input
      ref={(el) => registerRef(row.id, el)}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      disabled={saving}
      placeholder="Write your own example sentence…"
      className="text-[13px]"
      style={{ background: "var(--color-background)" }}
    />
  );
}

function InputTable({
  kind,
  round,
  showCompleted,
  items,
  setItems,
  loading,
  reload,
}: {
  kind: Kind;
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

  async function handleToggleRound(row: Row) {
    if (roundIdx > 0 && !row.rounds.slice(0, roundIdx).every(Boolean)) return;
    const next = !row.rounds[roundIdx];
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== row.id) return it;
        const rounds = [...it.rounds] as [boolean, boolean, boolean];
        rounds[roundIdx] = next;
        return { ...it, rounds };
      }),
    );
    try {
      await toggleRound(kind, row.id, round, next);
    } catch {
      reload();
    }
  }

  function handleExampleSubmit(row: Row, text: string) {
    const index = visible.findIndex((it) => it.id === row.id);
    const next = index >= 0 ? visible[index + 1] : undefined;
    setPendingFocusId(next ? next.id : null);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== row.id) return it;
        const rounds = [...it.rounds] as [boolean, boolean, boolean];
        rounds[roundIdx] = true;
        return { ...it, note: text, rounds };
      }),
    );
    toggleRound(kind, row.id, round, true).catch(() => reload());
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
      await masterItem(kind, row.id, round);
    } catch {
      reload();
    }
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
      className="overflow-hidden rounded-[20px]"
      style={{ border: "1px solid var(--color-border-default)", background: "var(--color-surface)" }}
    >
      <div
        className="sticky top-0 z-10 flex items-center gap-4 px-[18px] py-2.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground"
        style={{ background: "var(--color-surface-subtle)" }}
      >
        <div className="w-[28px] shrink-0">No.</div>
        <div className="flex-1">{kind === "grammar" ? "Grammar point" : "Phrase"}</div>
        <div className="w-[380px] shrink-0">Write your own example</div>
      </div>
      {visible.length === 0 ? (
        <div className="px-[18px] py-10 text-center text-sm text-muted-foreground">
          No items
        </div>
      ) : (
        visible.map((row) => {
          const locked = roundIdx > 0 && !row.rounds.slice(0, roundIdx).every(Boolean);
          const checked = row.rounds[roundIdx];
          const canSkipAhead = !locked && !checked && round < 3;
          const contentOpacity = locked ? 0.35 : checked ? 0.55 : 1;
          return (
            <div
              key={row.id}
              className="relative flex items-start gap-4 px-[18px] py-3.5 transition-colors"
              onClick={() => !locked && handleToggleRound(row)}
              style={{
                borderTop: "1px solid var(--color-border-default)",
                borderLeft: `2px solid ${checked ? "var(--color-primary)" : "transparent"}`,
                cursor: locked ? "default" : "pointer",
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
                <div className="text-[12.5px] leading-snug text-muted-foreground">
                  {row.jp}
                </div>
              </div>

              <div className="w-[380px] shrink-0" style={{ opacity: locked ? 0.35 : 1 }}>
                {!locked && (
                  <ExampleInput
                    kind={kind}
                    row={row}
                    registerRef={(id, el) => {
                      if (el) inputRefs.current.set(id, el);
                      else inputRefs.current.delete(id);
                    }}
                    onSubmit={handleExampleSubmit}
                  />
                )}
              </div>

              {canSkipAhead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMaster(row);
                  }}
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
  );
}

export default function LibraryInputPage() {
  const language = useCurrentLanguage();
  const router = useRouter();
  const [tab, setTab] = useState<Kind>("grammar");
  const [round, setRound] = useState<Round>(1);
  const [showCompleted, setShowCompleted] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { items, setItems, loading } = useLibraryItems(tab, reloadKey);

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

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex gap-1 rounded-full p-1"
          style={{ background: "var(--color-surface-subtle)" }}
        >
          {(["grammar", "expression"] as Kind[]).map((k) => {
            const active = tab === k;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="rounded-full px-[18px] py-2 text-[13.5px] font-semibold transition-colors"
                style={{
                  background: active ? "var(--color-surface)" : "transparent",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  boxShadow: active ? "var(--shadow-md)" : "none",
                }}
              >
                {k === "grammar" ? "Grammar" : "Phrases"}
              </button>
            );
          })}
        </div>
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
        kind={tab}
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
