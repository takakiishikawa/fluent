"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@takaki/go-design-system";

/**
 * 12週間（7行×12列＝84セル）のアクティビティヒートマップ。
 * アプリのプライマリ（青）に寄せた6段階グラデーション。
 * 列方向（grid-flow-col）に古い週→新しい週で並ぶ。
 * GitHub のように hover で日付と回数を tooltip 表示する。
 */

// 0 = 練習なし、1-5 = 練習量（Fluent ヒートマップトークン 5段階）
const HEAT = [
  "var(--color-heatmap-0)",
  "var(--color-heatmap-1)",
  "var(--color-heatmap-2)",
  "var(--color-heatmap-3)",
  "var(--color-heatmap-4)",
  "var(--color-heatmap-4)",
];

export type HeatmapCell = {
  date: string;
  /** リピーティング回数 */
  repeating: number;
  /** シャドーイング視聴分数 */
  shadowing: number;
  future: boolean;
};

function level(count: number): number {
  if (count <= 0) return 0;
  if (count < 10) return 1;
  if (count < 25) return 2;
  if (count < 45) return 3;
  if (count < 70) return 4;
  return 5;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(date + "T00:00:00"));
}

export function ActivityHeatmap({
  cells,
  monthLabels,
  streak,
  longest,
}: {
  cells: HeatmapCell[];
  monthLabels: string[];
  streak: number;
  longest: number;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--color-border-default)] bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">
          12週間のアクティビティ
        </h3>
        <p className="text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">{streak}</span>
          日連続 · 最長 {longest}日
        </p>
      </div>

      <TooltipProvider delayDuration={0}>
        <div
          className="mt-5 grid"
          style={{
            gridTemplateColumns: "repeat(12, 1fr)",
            gridTemplateRows: "repeat(7, 1fr)",
            gridAutoFlow: "column",
            gap: "5px",
            height: "196px",
          }}
        >
          {cells.map((c, i) => {
            const total = c.repeating + c.shadowing;
            const lv = c.future ? -1 : level(total);
            const parts: string[] = [];
            if (c.repeating > 0) parts.push(`リピート ${c.repeating}回`);
            if (c.shadowing > 0) parts.push(`シャドー ${c.shadowing}分`);
            const label = c.future
              ? formatDate(c.date)
              : parts.length > 0
                ? `${parts.join(" · ")} · ${formatDate(c.date)}`
                : `練習なし · ${formatDate(c.date)}`;
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className="cursor-default ring-foreground/30 transition-shadow hover:ring-2"
                    style={{
                      borderRadius: "3px",
                      background: HEAT[lv < 0 ? 0 : lv],
                      opacity: lv < 0 ? 0.4 : 1,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-[#1f1d1a] text-[12px] text-white dark:bg-[#2a2833] dark:text-[#f0eef4]"
                >
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {monthLabels.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
    </div>
  );
}
