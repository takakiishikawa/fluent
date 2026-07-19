"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Textarea, Button, toast } from "@takaki/go-design-system";
import { Lock, Check, MessageSquarePlus } from "lucide-react";
import { toggleRound, setItemNote } from "@/app/actions/practice";
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

const GRID_COLS = "48px 1fr 100px 120px";

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
      toast.error("メモの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setDraft(note ?? "");
          setOpen(true);
        }}
        className="mt-1.5 flex items-center gap-1.5 text-[12px]"
        style={{ color: note ? "var(--color-primary)" : "var(--color-text-secondary)" }}
      >
        <MessageSquarePlus className="h-3 w-3" />
        {note ? (note.length > 60 ? note.slice(0, 60) + "…" : note) : "Add note"}
      </button>
    );
  }

  return (
    <div className="mt-2">
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
          {saving ? "保存中..." : "保存"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}

function InputTable({
  kind,
  round,
  filterIncomplete,
}: {
  kind: Kind;
  round: Round;
  filterIncomplete: boolean;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const { items, setItems, loading } = useLibraryItems(kind, reloadKey);
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
      setReloadKey((k) => k + 1);
    }
  }

  const visible = filterIncomplete
    ? items.filter((it) => !it.rounds[roundIdx])
    : items;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        読み込み中...
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
        <div className="text-center">Round {round}</div>
        <div>Practice</div>
      </div>
      {visible.length === 0 ? (
        <div className="px-[18px] py-10 text-center text-sm text-muted-foreground">
          項目がありません
        </div>
      ) : (
        visible.map((row) => {
          const locked = roundIdx > 0 && !row.rounds.slice(0, roundIdx).every(Boolean);
          const checked = row.rounds[roundIdx];
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
              className="grid px-[18px] py-3.5"
              style={{
                gridTemplateColumns: GRID_COLS,
                borderTop: "1px solid var(--color-border-default)",
                alignItems: "start",
              }}
            >
              <div className="pt-0.5 text-[13px] text-foreground">{row.no}</div>
              <div>
                <div className="text-[14px] font-semibold text-foreground">
                  {row.title}
                </div>
                <div className="text-[12.5px] leading-snug text-muted-foreground">
                  {row.jp}
                </div>
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
              </div>
              <div className="flex justify-center pt-0.5">
                <button
                  onClick={() => handleToggleRound(row)}
                  disabled={locked}
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors disabled:cursor-default"
                  style={{
                    border: `1.5px solid ${locked ? "var(--color-border-default)" : checked ? "var(--color-primary)" : "var(--color-border-default)"}`,
                    background: locked ? "var(--color-surface-subtle)" : checked ? "var(--color-primary)" : "transparent",
                    color: locked ? "var(--color-text-secondary)" : "var(--color-surface)",
                  }}
                >
                  {locked ? (
                    <Lock className="h-3 w-3" />
                  ) : checked ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : null}
                </button>
              </div>
              <div className="pt-0.5 text-[12.5px] font-semibold" style={{ color: statusColor }}>
                {statusLabel}
              </div>
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

  useEffect(() => {
    if (language === "vi") router.replace("/list");
  }, [language, router]);

  if (language === "vi") return null;

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
            className="pb-2 pt-2 text-[14px] font-semibold transition-colors"
            style={{
              color: round === r ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              borderBottom: round === r ? "2px solid var(--color-primary)" : "2px solid transparent",
            }}
          >
            Round {r}
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

      <InputTable kind={tab} round={round} filterIncomplete={filterIncomplete} />
    </div>
  );
}
