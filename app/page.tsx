import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import Link from "next/link";
import {
  ActivityHeatmap,
  type HeatmapCell,
} from "@/components/activity-heatmap";
import { StreakPopup } from "@/components/streak-popup";
import { Check } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toStr = (d: Date): string => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number): Date =>
  new Date(d.getTime() + n * 86400000);

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 0;
  let current = sorted[0] === today ? today : yesterday;
  for (const date of sorted) {
    if (date === current) {
      streak++;
      current = new Date(new Date(current).getTime() - 86400000)
        .toISOString()
        .split("T")[0];
    } else {
      break;
    }
  }
  return streak;
}

function longestStreak(dates: string[]): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let current = 0;
  let prev = "";
  for (const date of sorted) {
    if (prev) {
      const diff =
        (new Date(date).getTime() - new Date(prev).getTime()) / 86400000;
      current = diff === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    if (current > best) best = current;
    prev = date;
  }
  return best;
}

const MONTH_ABBR = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

// ─── PlanRow ─────────────────────────────────────────────────────────────────

type PlanItem = {
  href: string;
  label: string;
  detail: string;
  done: boolean;
};

function PlanCard({ item }: { item: PlanItem }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[14px] px-3.5 py-3"
      style={{ border: "1px solid var(--color-border-default)" }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{
          border: `2px solid ${item.done ? "var(--color-primary)" : "var(--color-border-default)"}`,
          background: item.done ? "var(--color-primary)" : "transparent",
          color: "var(--color-surface)",
        }}
      >
        {item.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold text-foreground">
          {item.label}
        </div>
        <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          {item.detail}
        </div>
      </div>
      {!item.done && (
        <Link
          href={item.href}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
          style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
        >
          Start →
        </Link>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createClient();
  const currentLanguage = await getCurrentLanguage();
  const isVi = currentLanguage === "vi";

  const now = new Date();
  const todayStr = toStr(now);
  const todayUTC = new Date(todayStr + "T00:00:00Z");
  const weekday = todayUTC.getUTCDay(); // 0=Sun … 6=Sat

  const heatmapStart = addDays(todayUTC, -weekday - 77);
  const heatmapStartStr = toStr(heatmapStart);
  const rangeStartStr = toStr(addDays(todayUTC, -6));
  const weekAgoISO = addDays(now, -7).toISOString();

  const [
    allDatesResult,
    rangeLogsResult,
    youtubeLogsResult,
    settingsResult,
    outputTopicsResult,
    inputRoundsResult,
  ] = await Promise.all([
    supabase
      .from("practice_logs")
      .select("practiced_at")
      .eq("language", currentLanguage),
    supabase
      .from("practice_logs")
      .select(
        "practiced_at, grammar_done_count, expression_done_count, word_done_count",
      )
      .eq("language", currentLanguage)
      .gte("practiced_at", heatmapStartStr)
      .lte("practiced_at", todayStr)
      .order("practiced_at"),
    supabase
      .from("youtube_logs")
      .select("completed_at, video_id, youtube_videos(duration)")
      .eq("language", currentLanguage)
      .gte(
        "completed_at",
        new Date(heatmapStartStr + "T00:00:00").toISOString(),
      )
      .lte("completed_at", new Date(todayStr + "T23:59:59").toISOString()),
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase
      .from("output_topics")
      .select("responses, updated_at")
      .eq("language", currentLanguage),
    isVi
      ? Promise.resolve({ count: 0 })
      : (async () => {
          const [g, e] = await Promise.all([
            supabase
              .from("grammar")
              .select("id", { count: "exact", head: true })
              .eq("language", "en")
              .gte("rounds_updated_at", weekAgoISO),
            supabase
              .from("expressions")
              .select("id", { count: "exact", head: true })
              .eq("language", "en")
              .gte("rounds_updated_at", weekAgoISO),
          ]);
          return { count: (g.count ?? 0) + (e.count ?? 0) };
        })(),
  ]);

  type RangeLog = {
    practiced_at: string;
    grammar_done_count: number;
    expression_done_count: number;
    word_done_count: number;
  };

  let rangeLogs: RangeLog[];
  if (rangeLogsResult.error) {
    const { data: fallback } = await supabase
      .from("practice_logs")
      .select("practiced_at, grammar_done_count, expression_done_count")
      .eq("language", currentLanguage)
      .gte("practiced_at", heatmapStartStr)
      .lte("practiced_at", todayStr)
      .order("practiced_at");
    rangeLogs = (fallback ?? []).map((l) => ({
      practiced_at: l.practiced_at,
      grammar_done_count: l.grammar_done_count ?? 0,
      expression_done_count: l.expression_done_count ?? 0,
      word_done_count: 0,
    }));
  } else {
    rangeLogs = (rangeLogsResult.data ?? []).map((l) => ({
      practiced_at: l.practiced_at,
      grammar_done_count: l.grammar_done_count ?? 0,
      expression_done_count: l.expression_done_count ?? 0,
      word_done_count: l.word_done_count ?? 0,
    }));
  }

  const allDates = (allDatesResult.data ?? []).map((l) => l.practiced_at);
  const streak = calculateStreak(allDates);
  const longest = Math.max(longestStreak(allDates), streak);

  const dayTotal = (l: RangeLog) =>
    l.grammar_done_count + l.expression_done_count + l.word_done_count;

  const weeklyRepeating = rangeLogs
    .filter((l) => l.practiced_at >= rangeStartStr)
    .reduce((s, l) => s + dayTotal(l), 0);

  function parseDurToMin(dur: string | null | undefined): number {
    if (!dur) return 0;
    const parts = dur.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1];
    if (parts.length === 2) return parts[0];
    return 0;
  }
  const shadowingByDate = new Map<string, number>();
  const weeklyShadowingVideoIds = new Set<string>();
  let weeklyShadowing = 0;
  for (const yt of youtubeLogsResult.data ?? []) {
    const dateStr = yt.completed_at.slice(0, 10);
    const min = parseDurToMin(
      (yt.youtube_videos as unknown as { duration: string | null } | null)
        ?.duration,
    );
    shadowingByDate.set(dateStr, (shadowingByDate.get(dateStr) ?? 0) + min);
    if (dateStr >= rangeStartStr) {
      weeklyShadowingVideoIds.add(yt.video_id);
      weeklyShadowing += min;
    }
  }
  const weeklyShadowingVideos = weeklyShadowingVideoIds.size;

  const settings = settingsResult.data ?? null;

  // ── Output ──
  const hasWritten = (t: { responses: string[] }) =>
    t.responses.some((r) => r.trim().length > 0);
  const outputTopics = outputTopicsResult.data ?? [];
  const outputReadyCount = outputTopics.filter(hasWritten).length;
  const outputThisWeek = outputTopics.filter(
    (t) => hasWritten(t) && t.updated_at >= weekAgoISO,
  ).length;

  // ── 次の金曜日までの日数 ──
  const dow = now.getDay(); // 0=Sun..6=Sat
  const daysUntilFriday = (5 - dow + 7) % 7 || 7;

  // ── This week's plan（設定した週間目標に対する達成判定） ──
  const baselineRepeating = settings?.baseline_repeating ?? 500;
  const baselineShadowing = settings?.baseline_shadowing ?? 75;
  const baselineOutput = settings?.baseline_output ?? 2;
  const baselineInput = settings?.baseline_input ?? 1;
  const weeklyInputRounds = inputRoundsResult.count ?? 0;

  const planItems: PlanItem[] = [
    {
      href: "/repeating",
      label: "Repeating",
      detail: `${weeklyRepeating} / ${baselineRepeating} reps this week`,
      done: weeklyRepeating >= baselineRepeating,
    },
    {
      href: "/shadowing",
      label: isVi ? "Shadowing" : "Ryan",
      detail: `${weeklyShadowingVideos} video${weeklyShadowingVideos === 1 ? "" : "s"} · ${weeklyShadowing} / ${baselineShadowing} min this week`,
      done: weeklyShadowing >= baselineShadowing,
    },
    {
      href: "/output",
      label: "Output",
      detail: `${outputThisWeek} / ${baselineOutput} response${baselineOutput === 1 ? "" : "s"} this week`,
      done: outputThisWeek >= baselineOutput,
    },
    {
      href: isVi ? "/list" : "/library",
      label: isVi ? "Library" : "Input",
      detail: isVi
        ? `${weeklyInputRounds} round${weeklyInputRounds === 1 ? "" : "s"} this week`
        : `${weeklyInputRounds} / ${baselineInput} round${baselineInput === 1 ? "" : "s"} this week`,
      done: isVi ? true : weeklyInputRounds >= baselineInput,
    },
  ];
  const allPlanDone = planItems.every((p) => p.done);

  // ── 12週間ヒートマップ ──
  const countByDate = new Map<string, number>();
  for (const l of rangeLogs) {
    countByDate.set(l.practiced_at, dayTotal(l));
  }
  const heatmapCells: HeatmapCell[] = [];
  for (let col = 0; col < 12; col++) {
    const colStart = addDays(todayUTC, -weekday - (11 - col) * 7);
    for (let row = 0; row < 7; row++) {
      const cellStr = toStr(addDays(colStart, row));
      heatmapCells.push({
        date: cellStr,
        repeating: countByDate.get(cellStr) ?? 0,
        shadowing: shadowingByDate.get(cellStr) ?? 0,
        future: cellStr > todayStr,
      });
    }
  }
  const monthLabels: string[] = [];
  let lastMonth = -1;
  for (let col = 0; col < 12; col++) {
    const m = addDays(todayUTC, -weekday - (11 - col) * 7).getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push(MONTH_ABBR[m]);
      lastMonth = m;
    }
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <div className="w-full max-w-[980px]">
      <StreakPopup streak={streak} />

      <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--color-accent)" }}>
        {dateLabel}
      </div>
      <h1 className="mb-[22px] text-[30px] font-bold text-foreground">
        Good to see you back
      </h1>

      <Link
        href="/output"
        className="mb-[22px] flex items-center justify-between gap-4 rounded-[20px] px-5 py-4 text-[14.5px] text-foreground transition-opacity hover:opacity-90"
        style={{ background: "var(--color-primary-soft)" }}
      >
        <span className="leading-relaxed">
          <strong>Friday lesson in {daysUntilFriday} days.</strong>{" "}
          You have {outputReadyCount} Output responses ready to speak from.
        </span>
        <span
          className="shrink-0 font-semibold whitespace-nowrap"
          style={{ color: "var(--color-primary)" }}
        >
          Review →
        </span>
      </Link>

      <div
        className="mb-[22px] rounded-[20px] p-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="text-[14px] font-bold text-foreground">
            This week&apos;s plan
          </div>
          {allPlanDone && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold"
              style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              All clear this week
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {planItems.map((item) => (
            <PlanCard key={item.href} item={item} />
          ))}
        </div>
      </div>

      <ActivityHeatmap
        cells={heatmapCells}
        monthLabels={monthLabels}
        streak={streak}
        longest={longest}
      />
    </div>
  );
}
