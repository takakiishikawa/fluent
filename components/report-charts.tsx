"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ChartConfig } from "@takaki/go-design-system";

const ReportAreaChart = dynamic(
  () =>
    import("./report-area-chart").then((m) => ({
      default: m.ReportAreaChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[286px] rounded-[20px] border border-[var(--color-border-default)]" />
    ),
  },
);

type PracticeLog = {
  practiced_at: string;
  grammar_done_count: number;
  expression_done_count: number;
  word_done_count: number;
  speaking_count: number;
};

type YoutubeLog = {
  completed_at: string;
  youtube_videos: { duration: string | null } | null;
};

function parseDurToMin(dur: string | null | undefined): number {
  if (!dur) return 0;
  const parts = dur.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1];
  if (parts.length === 2) return parts[0];
  return 0;
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}/${m}`;
}

type ChartRow = Record<string, string | number>;

/** リピーティングを月単位で集計 */
function buildMonthlyRepeating(logs: PracticeLog[]): ChartRow[] {
  const map = new Map<
    string,
    { grammar: number; expression: number; word: number }
  >();
  for (const l of logs) {
    const ym = l.practiced_at.slice(0, 7);
    const e = map.get(ym) ?? { grammar: 0, expression: 0, word: 0 };
    map.set(ym, {
      grammar: e.grammar + l.grammar_done_count,
      expression: e.expression + l.expression_done_count,
      word: e.word + l.word_done_count,
    });
  }
  return [...map.keys()].sort().map((ym) => ({
    label: fmtMonth(ym),
    grammar: map.get(ym)?.grammar ?? 0,
    expression: map.get(ym)?.expression ?? 0,
    word: map.get(ym)?.word ?? 0,
  }));
}

/** シャドーイング（YouTube視聴時間）を月単位で集計 */
function buildMonthlyShadowing(youtubeLogs: YoutubeLog[]): ChartRow[] {
  const map = new Map<string, number>();
  for (const l of youtubeLogs) {
    const ym = l.completed_at.slice(0, 7);
    map.set(ym, (map.get(ym) ?? 0) + parseDurToMin(l.youtube_videos?.duration));
  }
  return [...map.keys()]
    .sort()
    .map((ym) => ({ label: fmtMonth(ym), minutes: map.get(ym) ?? 0 }));
}

const repeatingConfig: ChartConfig = {
  grammar: { label: "文法", color: "var(--color-primary)" },
  expression: { label: "フレーズ", color: "var(--color-primary-chart-2)" },
  word: { label: "単語", color: "var(--color-primary-chart-3)" },
};
const shadowingConfig: ChartConfig = {
  minutes: { label: "視聴時間", color: "var(--color-primary)" },
};

export function ReportCharts({
  logs,
  youtubeLogs,
  showWord = true,
}: {
  logs: PracticeLog[];
  youtubeLogs: YoutubeLog[];
  showWord?: boolean;
}) {
  const repeatingData = useMemo(() => buildMonthlyRepeating(logs), [logs]);
  const shadowingData = useMemo(
    () => buildMonthlyShadowing(youtubeLogs),
    [youtubeLogs],
  );

  // 英語モードでは単語シリーズを出さない
  const repeatingYKeys = showWord
    ? ["grammar", "expression", "word"]
    : ["grammar", "expression"];
  const repeatingChartConfig: ChartConfig = showWord
    ? repeatingConfig
    : {
        grammar: repeatingConfig.grammar,
        expression: repeatingConfig.expression,
      };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <ReportAreaChart
        data={repeatingData as Record<string, unknown>[]}
        config={repeatingChartConfig}
        xKey="label"
        yKeys={repeatingYKeys}
        title="リピーティング（月次）"
        unit="回"
        height={170}
      />
      <ReportAreaChart
        data={shadowingData as Record<string, unknown>[]}
        config={shadowingConfig}
        xKey="label"
        yKeys={["minutes"]}
        title="シャドーイング（月次）"
        unit="分"
        height={170}
      />
    </div>
  );
}
