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
  duration: string | null;
};

type OutputTopic = {
  responses: string[];
  updated_at: string;
};

type InputRound = {
  rounds_updated_at: string;
};

type SongEntry = {
  lines: { translation: string }[];
  updated_at: string;
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(Number(y), Number(m) - 1, 1));
}

type ChartRow = Record<string, string | number>;

/** Repeating, aggregated by month */
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

/** Shadowing (YouTube watch time), aggregated by month */
function buildMonthlyShadowing(youtubeLogs: YoutubeLog[]): ChartRow[] {
  const map = new Map<string, number>();
  for (const l of youtubeLogs) {
    const ym = l.completed_at.slice(0, 7);
    map.set(ym, (map.get(ym) ?? 0) + parseDurToMin(l.duration));
  }
  return [...map.keys()]
    .sort()
    .map((ym) => ({ label: fmtMonth(ym), minutes: map.get(ym) ?? 0 }));
}

/** Output, aggregated by month (non-empty response versions, bucketed by topic's updated_at) */
function buildMonthlyOutput(topics: OutputTopic[]): ChartRow[] {
  const map = new Map<string, number>();
  for (const t of topics) {
    const written = t.responses.filter((r) => r.trim().length > 0).length;
    if (written === 0) continue;
    const ym = t.updated_at.slice(0, 7);
    map.set(ym, (map.get(ym) ?? 0) + written);
  }
  return [...map.keys()]
    .sort()
    .map((ym) => ({ label: fmtMonth(ym), responses: map.get(ym) ?? 0 }));
}

/** Input, aggregated by month (grammar/expression rounds completed) */
function buildMonthlyInput(rounds: InputRound[]): ChartRow[] {
  const map = new Map<string, number>();
  for (const r of rounds) {
    const ym = r.rounds_updated_at.slice(0, 7);
    map.set(ym, (map.get(ym) ?? 0) + 1);
  }
  return [...map.keys()]
    .sort()
    .map((ym) => ({ label: fmtMonth(ym), rounds: map.get(ym) ?? 0 }));
}

/** Songs, aggregated by month (fully-translated songs, bucketed by updated_at) */
function buildMonthlySongs(songs: SongEntry[]): ChartRow[] {
  const map = new Map<string, number>();
  for (const s of songs) {
    if (s.lines.length === 0 || !s.lines.every((l) => l.translation.trim().length > 0)) {
      continue;
    }
    const ym = s.updated_at.slice(0, 7);
    map.set(ym, (map.get(ym) ?? 0) + 1);
  }
  return [...map.keys()]
    .sort()
    .map((ym) => ({ label: fmtMonth(ym), songs: map.get(ym) ?? 0 }));
}

const repeatingConfig: ChartConfig = {
  grammar: { label: "Grammar", color: "var(--color-primary)" },
  expression: { label: "Phrases", color: "var(--color-primary-chart-2)" },
  word: { label: "Words", color: "var(--color-primary-chart-3)" },
};
const shadowingConfig: ChartConfig = {
  minutes: { label: "Minutes", color: "var(--color-primary)" },
};
const outputConfig: ChartConfig = {
  responses: { label: "Responses", color: "var(--color-primary)" },
};
const inputConfig: ChartConfig = {
  rounds: { label: "Rounds", color: "var(--color-primary)" },
};
const songsConfig: ChartConfig = {
  songs: { label: "Songs", color: "var(--color-primary)" },
};

export function ReportCharts({
  logs,
  youtubeLogs,
  outputTopics,
  inputRounds,
  songs,
  showWord = true,
  showInputAndSongs = true,
  shadowingLabel = "Ryan",
}: {
  logs: PracticeLog[];
  youtubeLogs: YoutubeLog[];
  outputTopics: OutputTopic[];
  inputRounds: InputRound[];
  songs: SongEntry[];
  showWord?: boolean;
  showInputAndSongs?: boolean;
  shadowingLabel?: string;
}) {
  const repeatingData = useMemo(() => buildMonthlyRepeating(logs), [logs]);
  const shadowingData = useMemo(
    () => buildMonthlyShadowing(youtubeLogs),
    [youtubeLogs],
  );
  const outputData = useMemo(
    () => buildMonthlyOutput(outputTopics),
    [outputTopics],
  );
  const inputData = useMemo(
    () => buildMonthlyInput(inputRounds),
    [inputRounds],
  );
  const songsData = useMemo(() => buildMonthlySongs(songs), [songs]);

  // VI mode only: include the "word" series in Repeating
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
        title="Repeating"
        unit="reps"
        height={170}
      />
      <ReportAreaChart
        data={shadowingData as Record<string, unknown>[]}
        config={shadowingConfig}
        xKey="label"
        yKeys={["minutes"]}
        title={shadowingLabel}
        unit="min"
        height={170}
      />
      <ReportAreaChart
        data={outputData as Record<string, unknown>[]}
        config={outputConfig}
        xKey="label"
        yKeys={["responses"]}
        title="Output"
        unit="res."
        height={170}
      />
      {showInputAndSongs && (
        <>
          <ReportAreaChart
            data={inputData as Record<string, unknown>[]}
            config={inputConfig}
            xKey="label"
            yKeys={["rounds"]}
            title="Input"
            unit="rounds"
            height={170}
          />
          <ReportAreaChart
            data={songsData as Record<string, unknown>[]}
            config={songsConfig}
            xKey="label"
            yKeys={["songs"]}
            title="Songs"
            unit="songs"
            height={170}
          />
        </>
      )}
    </div>
  );
}
