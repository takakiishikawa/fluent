import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import Link from "next/link";
import {
  ActivityHeatmap,
  type HeatmapCell,
} from "@/components/activity-heatmap";
import { StreakPopup } from "@/components/streak-popup";

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

function pctOf(value: number, baseline: number | undefined, fallbackTarget: number): number {
  const target = baseline && baseline > 0 ? baseline : fallbackTarget;
  return Math.min(100, Math.round((value / target) * 100));
}

const MONTH_ABBR = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

// ─── QuickCard ─────────────────────────────────────────────────────────────────

function QuickCard({
  href,
  tileColor,
  title,
  subtitle,
  meta,
  metaColor,
}: {
  href: string;
  tileColor: string;
  title: string;
  subtitle: string;
  meta: string;
  metaColor: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col gap-2.5 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-surface)] p-[16px_18px] transition-transform hover:-translate-y-0.5"
      style={{ boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="h-[38px] w-[38px] shrink-0 rounded-[12px]"
          style={{ background: tileColor }}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate text-[15.5px] font-semibold text-foreground">
            {title}
          </div>
          <div className="truncate text-[13px] text-muted-foreground">
            {subtitle}
          </div>
        </div>
      </div>
      <div
        className="self-end text-[13px] font-semibold"
        style={{ color: metaColor }}
      >
        {meta}
      </div>
    </Link>
  );
}

// ─── WeekStatCard ────────────────────────────────────────────────────────────

function WeekStatCard({
  label,
  value,
  unit,
  delta,
  pct,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  delta: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-surface)] p-[18px_20px]">
      <div className="mb-2 text-[13px] text-muted-foreground">{label}</div>
      <div className="mb-2.5 flex items-baseline gap-1.5">
        <span className="text-[26px] font-bold text-foreground">{value}</span>
        <span className="text-[13px] text-muted-foreground">{unit}</span>
        <span className="ml-auto text-[12.5px] text-muted-foreground">
          {delta}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-subtle)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
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
  const prev7StartStr = toStr(addDays(todayUTC, -13));
  const weekAgoISO = addDays(now, -7).toISOString();

  const dueCountQuery = (table: string) =>
    supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("language", currentLanguage)
      .lt("play_count", 10);

  const [
    allDatesResult,
    rangeLogsResult,
    youtubeLogsResult,
    settingsResult,
    grammarDueResult,
    expressionDueResult,
    wordDueResult,
    outputTopicsResult,
    fixedChannelResult,
    efSetResult,
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
      .select("completed_at, youtube_videos(duration)")
      .eq("language", currentLanguage)
      .gte(
        "completed_at",
        new Date(heatmapStartStr + "T00:00:00").toISOString(),
      )
      .lte("completed_at", new Date(todayStr + "T23:59:59").toISOString()),
    supabase.from("user_settings").select("*").maybeSingle(),
    dueCountQuery("grammar"),
    dueCountQuery("expressions"),
    isVi ? dueCountQuery("words") : Promise.resolve({ count: 0 }),
    supabase
      .from("output_topics")
      .select("response, updated_at")
      .eq("language", currentLanguage),
    supabase
      .from("youtube_channels")
      .select("id")
      .eq("language", currentLanguage)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("ef_set_scores")
      .select("tested_at")
      .order("tested_at", { ascending: false })
      .limit(1),
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
  const prevWeeklyRepeating = rangeLogs
    .filter(
      (l) => l.practiced_at >= prev7StartStr && l.practiced_at < rangeStartStr,
    )
    .reduce((s, l) => s + dayTotal(l), 0);
  const hasPrevData = rangeLogs.some((l) => l.practiced_at < rangeStartStr);
  const repeatingDiff = hasPrevData ? weeklyRepeating - prevWeeklyRepeating : null;

  function parseDurToMin(dur: string | null | undefined): number {
    if (!dur) return 0;
    const parts = dur.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1];
    if (parts.length === 2) return parts[0];
    return 0;
  }
  let weeklyShadowing = 0;
  let prevWeeklyShadowing = 0;
  const shadowingByDate = new Map<string, number>();
  for (const yt of youtubeLogsResult.data ?? []) {
    const dateStr = yt.completed_at.slice(0, 10);
    const min = parseDurToMin(
      (yt.youtube_videos as unknown as { duration: string | null } | null)
        ?.duration,
    );
    shadowingByDate.set(dateStr, (shadowingByDate.get(dateStr) ?? 0) + min);
    if (dateStr >= rangeStartStr) weeklyShadowing += min;
    else if (dateStr >= prev7StartStr) prevWeeklyShadowing += min;
  }
  const shadowingDiff = hasPrevData ? weeklyShadowing - prevWeeklyShadowing : null;

  const settings = settingsResult.data ?? null;

  // ── Output ──
  const outputTopics = outputTopicsResult.data ?? [];
  const outputReadyCount = outputTopics.filter(
    (t) => t.response.trim().length > 0,
  ).length;
  const outputThisWeek = outputTopics.filter(
    (t) => t.response.trim().length > 0 && t.updated_at >= weekAgoISO,
  ).length;

  // ── Repeating due ──
  const repeatingDue =
    (grammarDueResult.count ?? 0) +
    (expressionDueResult.count ?? 0) +
    (wordDueResult.count ?? 0);

  // ── Shadowing done/total（固定チャンネル・現在の周回） ──
  const fixedChannelId = fixedChannelResult.data?.[0]?.id ?? null;
  let shadowingDone = 0;
  let shadowingTotal = 0;
  if (fixedChannelId) {
    const [videosRes, logsRes] = await Promise.all([
      supabase
        .from("youtube_videos")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", fixedChannelId),
      supabase
        .from("youtube_logs")
        .select("video_id")
        .eq("language", currentLanguage),
    ]);
    shadowingTotal = videosRes.count ?? 0;
    shadowingDone = new Set((logsRes.data ?? []).map((l) => l.video_id)).size;
  }

  // ── 次の金曜日までの日数 ──
  const dow = now.getDay(); // 0=Sun..6=Sat
  const daysUntilFriday = (5 - dow + 7) % 7 || 7;

  // ── EF SET 受検時期チェック ──
  const efSetIntervalMonths = settings?.ef_set_interval_months ?? 3;
  const latestEfSet =
    (efSetResult.data as { tested_at: string }[] | null)?.[0]?.tested_at ??
    null;
  let efSetDue = !isVi;
  if (latestEfSet) {
    const [ey, em, ed] = latestEfSet.split("-").map(Number);
    const dueDate = new Date(ey, em - 1 + efSetIntervalMonths, ed);
    efSetDue = !isVi && now >= dueDate;
  }

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

  const repeatingPct = pctOf(weeklyRepeating, settings?.baseline_repeating, 150);
  const shadowingPct = pctOf(weeklyShadowing, settings?.baseline_shadowing, 60);
  const outputPct = Math.min(100, Math.round((outputThisWeek / 3) * 100));

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

      {efSetDue && (
        <Link
          href="/report"
          className="mb-[22px] -mt-3 flex items-center gap-2 text-[12.5px] font-medium"
          style={{ color: "var(--color-accent)" }}
        >
          EF SET の受検時期です — レポートでスコアを記録 →
        </Link>
      )}

      <div className="mb-[22px] grid grid-cols-3 gap-4">
        <QuickCard
          href="/repeating"
          tileColor="var(--color-primary-soft)"
          title="Repeating"
          subtitle={isVi ? "Grammar, phrases & words" : "Grammar & phrases"}
          meta={`${repeatingDue} due`}
          metaColor="var(--color-primary)"
        />
        <QuickCard
          href="/shadowing"
          tileColor="var(--color-accent-soft)"
          title="Shadowing"
          subtitle="YouTube practice"
          meta={`${shadowingDone}/${shadowingTotal}`}
          metaColor="var(--color-accent)"
        />
        <QuickCard
          href="/output"
          tileColor="var(--color-surface-subtle)"
          title="Output"
          subtitle="Write from a topic"
          meta={`${outputReadyCount} written`}
          metaColor="var(--color-text-primary)"
        />
      </div>

      <div className="mb-[22px] grid grid-cols-3 gap-4">
        <WeekStatCard
          label="Repeating this week"
          value={weeklyRepeating}
          unit="reps"
          delta={repeatingDiff == null ? "" : `${repeatingDiff > 0 ? "+" : ""}${repeatingDiff} vs last week`}
          pct={repeatingPct}
          color="var(--color-primary)"
        />
        <WeekStatCard
          label="Shadowing this week"
          value={weeklyShadowing}
          unit="min"
          delta={shadowingDiff == null ? "" : `${shadowingDiff > 0 ? "+" : ""}${shadowingDiff} vs last week`}
          pct={shadowingPct}
          color="var(--color-accent)"
        />
        <WeekStatCard
          label="Output entries"
          value={outputThisWeek}
          unit="written"
          delta="this week"
          pct={outputPct}
          color="var(--color-text-primary)"
        />
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
