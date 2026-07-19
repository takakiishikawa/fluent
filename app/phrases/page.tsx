"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn, EmptyState, PageHeader } from "@takaki/go-design-system";
import { PhraseTab } from "@/app/list/page";
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

type Kind = "phrase" | "word";

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

type Entry = {
  id: string;
  vn: string;
  ja: string;
  category: string | null;
  kind: Kind;
};
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

function EntryList({ entries }: { entries: Entry[] }) {
  return (
    <ul className="space-y-2.5">
      {entries.map((e) => (
        <li
          key={`${e.kind}-${e.id}`}
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
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </div>
  );
}

function EnPhraseCatalog() {
  const [reloadKey, setReloadKey] = useState(0);
  const bumpReload = useCallback(() => setReloadKey((k) => k + 1), []);
  return (
    <div className="space-y-6">
      <PageHeader title="フレーズカタログ" />
      <PhraseTab reloadKey={reloadKey} bumpReload={bumpReload} />
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

  // フレーズ・単語を一つの軸（場面 = category）にまとめる
  const items: Entry[] = useMemo(() => {
    const fromExpr: Entry[] = expressions.map((e) => ({
      id: e.id,
      vn: e.expression,
      ja: (e.meaning ?? "").replace(/\\n/g, " "),
      category: e.category,
      kind: "phrase",
    }));
    const fromWord: Entry[] = words.map((w) => ({
      id: w.id,
      vn: w.word,
      ja: (w.meaning ?? "").replace(/\\n/g, " "),
      category: w.category,
      kind: "word",
    }));
    return [...fromExpr, ...fromWord];
  }, [expressions, words]);

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

  const { phrases, vocab } = useMemo(() => {
    const inScene = active
      ? items.filter((e) => sceneOf(e) === active)
      : items;
    return {
      phrases: inScene.filter((e) => e.kind === "phrase"),
      vocab: inScene.filter((e) => e.kind === "word"),
    };
  }, [items, active]);

  if (!isVi) {
    return <EnPhraseCatalog />;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="フレーズ・単語がまだありません"
        description="ライブラリで追加し、場面タグ（カテゴリ）を設定するとここに並びます。"
      />
    );
  }

  const bothKinds = phrases.length > 0 && vocab.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* 場面選択 */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">今どこにいる？</h2>
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

      {/* 選択した場面のフレーズ・単語 */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">{active}</h2>

        {phrases.length > 0 && (
          <div className="space-y-2.5">
            {bothKinds && <GroupLabel>フレーズ</GroupLabel>}
            <EntryList entries={phrases} />
          </div>
        )}

        {vocab.length > 0 && (
          <div className="space-y-2.5">
            {bothKinds && <GroupLabel>単語</GroupLabel>}
            <EntryList entries={vocab} />
          </div>
        )}
      </section>
    </div>
  );
}
