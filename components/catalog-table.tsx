"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";
import { toggleUnderstood } from "@/app/actions/practice";

type Kind = "grammar" | "expression";

type Row = {
  id: string;
  no: number;
  title: string;
  jp: string;
  understood: boolean;
  playCount: number;
  level: number;
};

const GRID_COLS = "52px 1fr 100px 70px 110px";

export function CatalogTable({ kind }: { kind: Kind }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Row[]>([]);
  const [level, setLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const table = kind === "grammar" ? "grammar" : "expressions";
      const { data } = await supabase
        .from(table)
        .select("*, lessons(level, lesson_no)")
        .eq("language", "en");
      if (cancelled) return;
      const sorted = [...(data ?? [])].sort((a, b) => {
        const an = a.lessons?.lesson_no ?? "";
        const bn = b.lessons?.lesson_no ?? "";
        return an.localeCompare(bn, undefined, { numeric: true });
      });
      const rows: Row[] = sorted.map((r, i) => ({
        id: r.id,
        no: i + 1,
        title: kind === "grammar" ? r.name : r.expression,
        jp: (kind === "grammar" ? r.summary : r.meaning) ?? "",
        understood: r.understood ?? false,
        playCount: r.play_count ?? 0,
        level: r.lessons?.level ?? 0,
      }));
      setItems(rows);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [kind, supabase]);

  const levelCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const it of items) m.set(it.level, (m.get(it.level) ?? 0) + 1);
    return [...m.entries()]
      .filter(([lv]) => lv > 0)
      .sort((a, b) => a[0] - b[0]);
  }, [items]);

  useEffect(() => {
    if (level === null && levelCounts.length > 0) setLevel(levelCounts[0][0]);
  }, [level, levelCounts]);

  const visible = level === null ? items : items.filter((it) => it.level === level);
  const masteredCount = items.filter((it) => it.playCount >= 10).length;
  const practiceCount = items.length - masteredCount;

  async function handleToggle(row: Row) {
    const next = !row.understood;
    setItems((prev) =>
      prev.map((it) => (it.id === row.id ? { ...it, understood: next } : it)),
    );
    try {
      await toggleUnderstood(kind, row.id, next);
    } catch {
      setItems((prev) =>
        prev.map((it) => (it.id === row.id ? { ...it, understood: !next } : it)),
      );
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-[18px] flex flex-wrap gap-2">
        {levelCounts.map(([lv, count]) => {
          const active = level === lv;
          return (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={{
                border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border-default)"}`,
                background: active ? "var(--color-primary-soft)" : "var(--color-surface)",
                color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
              }}
            >
              Level {lv} · {count}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex gap-2.5">
        <span
          className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
          style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
        >
          Mastered {masteredCount}
        </span>
        <span
          className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
          style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
        >
          In practice {practiceCount}
        </span>
      </div>

      <div
        className="overflow-hidden rounded-[20px]"
        style={{ border: "1px solid var(--color-border-default)" }}
      >
        <div
          className="grid px-[18px] py-2.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground"
          style={{ gridTemplateColumns: GRID_COLS, background: "var(--color-surface-subtle)" }}
        >
          <div>No.</div>
          <div>{kind === "grammar" ? "Grammar point" : "Phrase"}</div>
          <div>Understood</div>
          <div>Reps</div>
          <div>Status</div>
        </div>
        {visible.length === 0 ? (
          <div className="px-[18px] py-10 text-center text-sm text-muted-foreground">
            項目がありません
          </div>
        ) : (
          visible.map((row) => {
            const mastered = row.playCount >= 10;
            return (
              <div
                key={row.id}
                className="grid items-center px-[18px] py-3.5"
                style={{
                  gridTemplateColumns: GRID_COLS,
                  borderTop: "1px solid var(--color-border-default)",
                  background: "var(--color-surface)",
                }}
              >
                <div className="text-[13px] text-foreground">{row.no}</div>
                <div>
                  <div className="mb-0.5 text-[14px] font-semibold text-foreground">
                    {row.title}
                  </div>
                  <div className="text-[12.5px] leading-snug text-muted-foreground">
                    {row.jp}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(row)}
                  className="flex h-6 w-6 items-center justify-center font-bold"
                  style={{ color: row.understood ? "var(--color-primary)" : "var(--color-border-default)" }}
                  aria-label="Understood"
                  aria-pressed={row.understood}
                >
                  {row.understood ? <Check className="h-4 w-4" /> : "–"}
                </button>
                <div className="text-[13px] text-muted-foreground tabular-nums">
                  {row.playCount}/10
                </div>
                <span
                  className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                  style={{
                    color: mastered ? "var(--color-primary)" : "var(--color-accent)",
                    background: mastered ? "var(--color-primary-soft)" : "var(--color-accent-soft)",
                  }}
                >
                  {mastered ? "Mastered" : "In practice"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
