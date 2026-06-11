"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn, EmptyState } from "@takaki/go-design-system";
import {
  Coffee,
  ShoppingBag,
  Briefcase,
  Users,
  Utensils,
  Plane,
  Home,
  Heart,
  Hand,
  UserRound,
  Lightbulb,
  Phone,
  HeartHandshake,
  Wallet,
  BookOpen,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { Expression, Word } from "@/lib/types";
import { useCurrentLanguage } from "@/lib/language-context";
import { PhraseAudioButton } from "@/components/phrase-audio-button";

const UNCATEGORIZED = "未分類";

type Mode = "phrase" | "word";

// AI 抽出が付ける日本語カテゴリと手動の場面タグの両方を緩くカバーする。
const SCENE_ICON_RULES: { test: RegExp; icon: LucideIcon }[] = [
  { test: /カフェ|coffee|cafe|喫茶/i, icon: Coffee },
  { test: /市場|買い物|買物|ショッピング|店|shop|market/i, icon: ShoppingBag },
  { test: /職場|仕事|会社|オフィス|work|office|business/i, icon: Briefcase },
  { test: /食事|レストラン|飲食|food|restaurant|meal|食べ|料理/i, icon: Utensils },
  { test: /肉|魚介|野菜|果物|食品|飲み物|fruit|vegetable/i, icon: Utensils },
  { test: /旅行|空港|移動|travel|trip|airport/i, icon: Plane },
  { test: /家|自宅|家族|home|family/i, icon: Home },
  { test: /恋愛|デート|love|date/i, icon: Heart },
  { test: /挨拶|あいさつ|greeting/i, icon: Hand },
  { test: /自己紹介|呼称|名前|introduction/i, icon: UserRound },
  { test: /提案|誘い|勧誘|suggest|invite/i, icon: Lightbulb },
  { test: /電話|連絡|phone|call/i, icon: Phone },
  { test: /感謝|お礼|謝罪|thanks|apolog/i, icon: HeartHandshake },
  { test: /通貨|単位|お金|金額|数|money|currency/i, icon: Wallet },
  { test: /形容詞|動詞|名詞|副詞|代名詞|品詞|文型|助詞/i, icon: BookOpen },
  { test: /友達|友人|友|雑談|relationship|friend/i, icon: Users },
];

function sceneIcon(scene: string): LucideIcon {
  for (const r of SCENE_ICON_RULES) if (r.test.test(scene)) return r.icon;
  return MessageCircle;
}

type Entry = { id: string; vn: string; ja: string; category: string | null };
type Scene = { name: string; count: number; icon: LucideIcon };

function SceneCard({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-3 transition-colors",
        active
          ? "border-[color:var(--color-primary)] bg-[var(--color-primary)]/10 text-[color:var(--color-primary)]"
          : "border-transparent bg-muted text-muted-foreground hover:bg-muted/70",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span
        className={cn(
          "max-w-full truncate text-xs font-medium",
          active ? "text-[color:var(--color-primary)]" : "text-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const tabs: { value: Mode; label: string }[] = [
    { value: "phrase", label: "フレーズ" },
    { value: "word", label: "単語" },
  ];
  return (
    <div className="inline-flex rounded-full bg-muted p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            "min-w-[88px] rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
            mode === t.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function PhrasesPage() {
  const supabase = useMemo(() => createClient(), []);
  const language = useCurrentLanguage();
  const isVi = language === "vi";
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("phrase");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!isVi) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase
        .from("expressions")
        .select("*")
        .eq("language", "vi")
        .order("created_at", { ascending: true }),
      supabase
        .from("words")
        .select("*")
        .eq("language", "vi")
        .order("created_at", { ascending: true }),
    ]).then(([e, w]) => {
      if (cancelled) return;
      setExpressions((e.data ?? []) as Expression[]);
      setWords((w.data ?? []) as Word[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isVi, supabase]);

  const items: Entry[] = useMemo(() => {
    if (mode === "phrase") {
      return expressions.map((e) => ({
        id: e.id,
        vn: e.expression,
        ja: (e.meaning ?? "").replace(/\\n/g, " "),
        category: e.category,
      }));
    }
    return words.map((w) => ({
      id: w.id,
      vn: w.word,
      ja: (w.meaning ?? "").replace(/\\n/g, " "),
      category: w.category,
    }));
  }, [mode, expressions, words]);

  const sceneOf = (e: Entry) => e.category?.trim() || UNCATEGORIZED;

  const scenes: Scene[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of items) {
      const s = sceneOf(e);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const named = [...counts.entries()]
      .filter(([name]) => name !== UNCATEGORIZED)
      // 件数の多い順（よく使う場面を上に）。同数は名前順
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([name, count]) => ({ name, count, icon: sceneIcon(name) }));
    if (counts.has(UNCATEGORIZED)) {
      named.push({
        name: UNCATEGORIZED,
        count: counts.get(UNCATEGORIZED)!,
        icon: MessageCircle,
      });
    }
    return named;
  }, [items]);

  // 未選択なら先頭の場面を既定にする
  const active = selected ?? scenes[0]?.name ?? null;

  const filtered = useMemo(
    () => (active ? items.filter((e) => sceneOf(e) === active) : items),
    [items, active],
  );

  function switchMode(m: Mode) {
    setMode(m);
    setSelected(null); // モードでカテゴリ体系が変わるので選択をリセット
  }

  if (!isVi) {
    return (
      <EmptyState
        title="ベトナム語専用の機能です"
        description="言語をベトナム語に切り替えると、場面別のフレーズ・単語が表示されます。"
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  const sceneHeading = mode === "phrase" ? "今どこにいる？" : "どんな単語？";
  const kindLabel = mode === "phrase" ? "フレーズ" : "単語";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex justify-center">
        <ModeToggle mode={mode} onChange={switchMode} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={`${kindLabel}がまだありません`}
          description="ライブラリで追加し、場面タグ（カテゴリ）を設定するとここに並びます。"
        />
      ) : (
        <>
          {/* 場面（カテゴリ）選択 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">{sceneHeading}</h2>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {scenes.map((s) => (
                <SceneCard
                  key={s.name}
                  label={s.name}
                  icon={s.icon}
                  active={active === s.name}
                  onClick={() => setSelected(s.name)}
                />
              ))}
            </div>
          </section>

          {/* リスト */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">
              {active}の{kindLabel}
            </h2>
            <ul className="space-y-2.5">
              {filtered.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl bg-[var(--color-primary)]/8 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-bold leading-snug text-foreground">
                      {e.vn}
                    </p>
                    {e.ja && (
                      <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                        {e.ja}
                      </p>
                    )}
                  </div>
                  <PhraseAudioButton text={e.vn} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
