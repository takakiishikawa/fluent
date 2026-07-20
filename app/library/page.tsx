"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Textarea, Button, toast } from "@takaki/go-design-system";
import { Lock, Check, MessageSquarePlus, Sparkles } from "lucide-react";
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
  playCount: number;
};

const GRID_COLS = "48px 1fr 120px";

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
          playCount: r.play_count ?? 0,
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

function NoteRow({
  kind,
  id,
  note,
  onChanged,
}: {
  kind: Kind;
  id: string;
  note: string | null;
  onChanged: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);

  async function commit() {
    setSaving(true);
    try {
      await setItemNote(kind, id, draft);
      onChanged(draft.trim() || null);
      setOpen(false);
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDraft(note ?? "");
          setOpen(true);
        }}
        className="mt-1.5 flex items-start gap-1.5 text-left text-[12px]"
        style={{ color: note ? "var(--color-primary)" : "var(--color-text-secondary)" }}
      >
        <MessageSquarePlus className="mt-[1px] h-3 w-3 shrink-0" />
        <span className="text-left">
          {note ? (note.length > 60 ? note.slice(0, 60) + "…" : note) : "Add note"}
        </span>
      </button>
    );
  }

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <Textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        className="text-[13px]"
        style={{ background: "var(--color-background)" }}
      />
      <div className="mt-1.5 flex gap-2">
        <Button size="sm" onClick={commit} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function InputTable({
  kind,
  round,
  filterIncomplete,
  items,
  setItems,
  loading,
  reload,
}: {
  kind: Kind;
  round: Round;
  filterIncomplete: boolean;
  items: Row[];
  setItems: React.Dispatch<React.SetStateAction<Row[]>>;
  loading: boolean;
  reload: () => void;
}) {
  const roundIdx = round - 1;

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

  const visible = filterIncomplete
    ? items.filter((it) => !it.rounds[roundIdx])
    : items;

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
        className="grid px-[18px] py-2.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground"
        style={{ gridTemplateColumns: GRID_COLS, background: "var(--color-surface-subtle)" }}
      >
        <div>No.</div>
        <div>{kind === "grammar" ? "Grammar point" : "Phrase"}</div>
        <div>Practice</div>
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
          const statusLabel =
            row.playCount === 0 ? "New" : row.playCount >= 10 ? "Mastered" : "In progress";
          const statusColor =
            row.playCount === 0
              ? "var(--color-text-secondary)"
              : row.playCount >= 10
                ? "var(--color-primary)"
                : "var(--color-accent)";
          return (
            <div
              key={row.id}
              className="group relative grid px-[18px] py-3.5 transition-colors"
              onClick={() => !locked && handleToggleRound(row)}
              style={{
                gridTemplateColumns: GRID_COLS,
                borderTop: "1px solid var(--color-border-default)",
                alignItems: "start",
                cursor: locked ? "default" : "pointer",
                background: checked
                  ? "color-mix(in oklch, var(--color-primary-soft) 40%, var(--color-surface))"
                  : undefined,
                boxShadow: checked ? "inset 3px 0 0 var(--color-primary)" : undefined,
              }}
            >
              <div
                className="pt-0.5 text-[13px] text-foreground"
                style={{ opacity: locked ? 0.35 : 1 }}
              >
                {row.no}
              </div>
              <div style={{ opacity: locked ? 0.35 : 1 }}>
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
                {!locked && (
                  <NoteRow
                    kind={kind}
                    id={row.id}
                    note={row.note}
                    onChanged={(next) =>
                      setItems((prev) =>
                        prev.map((it) => (it.id === row.id ? { ...it, note: next } : it)),
                      )
                    }
                  />
                )}
              </div>
              <div
                className="flex items-center justify-between gap-2 pt-0.5"
                style={{ opacity: locked ? 0.35 : 1 }}
              >
                <span className="text-[12.5px] font-semibold" style={{ color: statusColor }}>
                  {statusLabel}
                </span>
                {canSkipAhead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMaster(row);
                    }}
                    title="Mark fully understood — skip remaining rounds"
                    className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                      color: "var(--color-accent)",
                      background: "var(--color-accent-soft)",
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    Skip ahead
                  </button>
                )}
              </div>

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
  const [filterIncomplete, setFilterIncomplete] = useState(false);
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
        <button
          onClick={() => setFilterIncomplete((v) => !v)}
          className="mb-2 ml-auto rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors"
          style={{
            border: `1px solid ${filterIncomplete ? "var(--color-primary)" : "var(--color-border-default)"}`,
            background: filterIncomplete ? "var(--color-primary-soft)" : "var(--color-surface)",
            color: filterIncomplete ? "var(--color-primary)" : "var(--color-text-secondary)",
          }}
        >
          Show remaining only
        </button>
      </div>

      <InputTable
        kind={tab}
        round={round}
        filterIncomplete={filterIncomplete}
        items={items}
        setItems={setItems}
        loading={loading}
        reload={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
