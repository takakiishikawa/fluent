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
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { Expression } from "@/lib/types";
import { useCurrentLanguage } from "@/lib/language-context";
import { PhraseAudioButton } from "@/components/phrase-audio-button";

const UNCATEGORIZED = "未分類";

// 場面名 → アイコン（キーワードで緩く対応。未知の場面は会話アイコン）
// AI 抽出が付ける日本語カテゴリ（挨拶 / 食事 / 買い物 / 仕事 / 雑談 …）と
// 手動の場面タグ（カフェ / 市場 / 職場 …）の両方を緩くカバーする。
const SCENE_ICON_RULES: { test: RegExp; icon: LucideIcon }[] = [
  { test: /カフェ|coffee|cafe|喫茶/i, icon: Coffee },
  { test: /市場|買い物|買物|ショッピング|店|shop|market/i, icon: ShoppingBag },
  { test: /職場|仕事|会社|オフィス|work|office|business/i, icon: Briefcase },
  { test: /食事|レストラン|飲食|food|restaurant|meal|食べ/i, icon: Utensils },
  { test: /旅行|空港|移動|travel|trip|airport/i, icon: Plane },
  { test: /家|自宅|家族|home|family/i, icon: Home },
  { test: /恋愛|デート|love|date/i, icon: Heart },
  { test: /挨拶|あいさつ|greeting/i, icon: Hand },
  { test: /自己紹介|呼称|名前|introduction/i, icon: UserRound },
  { test: /提案|誘い|勧誘|suggest|invite/i, icon: Lightbulb },
  { test: /電話|連絡|phone|call/i, icon: Phone },
  { test: /感謝|お礼|謝罪|thanks|apolog/i, icon: HeartHandshake },
  { test: /友達|友人|友|雑談|relationship|friend/i, icon: Users },
];

function sceneIcon(scene: string): LucideIcon {
  for (const r of SCENE_ICON_RULES) if (r.test.test(scene)) return r.icon;
  return MessageCircle;
}

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
        "flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border-2 transition-colors",
        active
          ? "border-[color:var(--color-primary)] bg-[var(--color-primary)]/10 text-[color:var(--color-primary)]"
          : "border-transparent bg-muted text-muted-foreground hover:bg-muted/70",
      )}
    >
      <Icon className="h-7 w-7 shrink-0" />
      <span
        className={cn(
          "text-sm font-medium",
          active ? "text-[color:var(--color-primary)]" : "text-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

export default function PhrasesPage() {
  const supabase = useMemo(() => createClient(), []);
  const language = useCurrentLanguage();
  const isVi = language === "vi";
  const [items, setItems] = useState<Expression[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!isVi) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("expressions")
      .select("*")
      .eq("language", "vi")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setItems((data ?? []) as Expression[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isVi, supabase]);

  const sceneOf = (e: Expression) => e.category?.trim() || UNCATEGORIZED;

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

  if (!isVi) {
    return (
      <EmptyState
        title="ベトナム語専用の機能です"
        description="言語をベトナム語に切り替えると、場面別のフレーズが表示されます。"
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

  if (items.length === 0) {
    return (
      <EmptyState
        title="フレーズがまだありません"
        description="ライブラリでフレーズを追加し、場面タグを設定するとここに並びます。"
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* 場面選択 */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">今どこにいる？</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

      {/* フレーズリスト */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          {active}のフレーズ
        </h2>
        <ul className="space-y-2.5">
          {filtered.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-xl bg-[var(--color-primary)]/8 px-4 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold leading-snug text-foreground">
                  {e.expression}
                </p>
                {e.meaning && (
                  <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                    {e.meaning.replace(/\\n/g, " ")}
                  </p>
                )}
              </div>
              <PhraseAudioButton text={e.expression} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
