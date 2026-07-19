"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent } from "@takaki/go-design-system";
import { useCurrentLanguage } from "@/lib/language-context";

type Category = "grammar" | "expression" | "word";
type Counts = Record<Category, number>;

const COUNT_PRESETS = [10, 30] as const;
const COUNT_TAGS = ["Quick", "Focused"] as const;

const TABLE_BY_CATEGORY: Record<Category, string> = {
  grammar: "grammar",
  expression: "expressions",
  word: "words",
};

const ALL_CATEGORIES: Category[] = ["grammar", "expression", "word"];

const CATEGORIES_VI: { value: Category; label: string }[] = [
  { value: "grammar", label: "文法" },
  { value: "expression", label: "フレーズ" },
  { value: "word", label: "単語" },
];

const CATEGORIES_EN: { value: Category; label: string }[] = [
  { value: "grammar", label: "Grammar" },
  { value: "expression", label: "Phrases" },
];

export function RepeatingPickerDialog({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const language = useCurrentLanguage();
  const [category, setCategory] = useState<Category>("grammar");
  const [counts, setCounts] = useState<Counts | null>(null);

  const categories = language === "vi" ? CATEGORIES_VI : CATEGORIES_EN;

  // 別ページの Dialog/Sheet がナビゲーション中にアンマウントすると
  // body に pointer-events:none が残り、本ダイアログが操作不能になることがある
  useEffect(() => {
    if (document.body.style.pointerEvents === "none") {
      document.body.style.pointerEvents = "";
    }
  }, []);

  // カテゴリごとの「練習中（play_count < 10）」件数を取得し、件数選択を実データに合わせる
  useEffect(() => {
    const supabase = createClient();
    Promise.all(
      ALL_CATEGORIES.map((c) =>
        supabase
          .from(TABLE_BY_CATEGORY[c])
          .select("id", { count: "exact", head: true })
          .eq("language", language)
          .lt("play_count", 10),
      ),
    ).then((results) => {
      const next: Counts = { grammar: 0, expression: 0, word: 0 };
      ALL_CATEGORIES.forEach((c, i) => {
        next[c] = results[i].count ?? 0;
      });
      setCounts(next);
    });
  }, [language]);

  function handleClose() {
    if (onClose) onClose();
    else router.push("/");
  }

  function handlePickCount(n: number) {
    router.push(`/repeating/${category}?count=${n}`);
  }

  const total = counts ? counts[category] : 0;
  const seen = new Set<number>();
  const countOptions = [
    ...COUNT_PRESETS.map((n, i) => ({
      count: Math.min(n, total),
      tag: COUNT_TAGS[i],
    })),
    { count: total, tag: "Deep" },
  ].filter((o) => {
    if (o.count <= 0 || seen.has(o.count)) return false;
    seen.add(o.count);
    return true;
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        className="w-[360px] max-w-[calc(100%-2rem)] gap-0 rounded-[20px] p-[22px]"
        style={{
          background: "var(--color-surface)",
          boxShadow: "var(--shadow-md)",
          border: "1px solid var(--color-border-default)",
        }}
        aria-describedby={undefined}
      >
        <div className="mb-4 pr-6">
          <span className="text-[17px] font-bold text-foreground">
            Start repeating
          </span>
        </div>

        <div className="mb-[18px] flex gap-2">
          {categories.map((c) => {
            const active = category === c.value;
            const available = counts?.[c.value] ?? null;
            return (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                disabled={available === 0}
                className="flex-1 rounded-[12px] px-1.5 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-40"
                style={{
                  border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border-default)"}`,
                  background: active ? "var(--color-primary-soft)" : "var(--color-surface)",
                  color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
                }}
              >
                {c.label} · {available ?? "…"}
              </button>
            );
          })}
        </div>

        <div className="mb-2 text-[12.5px] font-semibold text-muted-foreground">
          How many?
        </div>
        <div className="flex flex-col gap-2">
          {countOptions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              練習できる項目がありません
            </p>
          ) : (
            countOptions.map((o) => (
              <button
                key={o.count}
                onClick={() => handlePickCount(o.count)}
                className="flex items-center justify-between rounded-[12px] px-4 py-3 text-[14px] font-semibold text-foreground transition-colors hover:bg-[var(--color-surface-subtle)]"
                style={{ border: "1px solid var(--color-border-default)" }}
              >
                <span>{o.count} items</span>
                <span className="text-[12px] font-medium text-muted-foreground">
                  {o.tag}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
