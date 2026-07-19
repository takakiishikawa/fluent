import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import { ReportCharts } from "@/components/report-charts";
import { EfSetSection, type EfSetScore } from "@/components/ef-set-section";

export default async function ReportPage() {
  const supabase = await createClient();
  const language = await getCurrentLanguage();
  const isEn = language === "en";

  const [logsResult, youtubeLogsResult, efSetResult] = await Promise.all([
    supabase
      .from("practice_logs")
      .select(
        "practiced_at, grammar_done_count, expression_done_count, word_done_count, speaking_count",
      )
      .eq("language", language)
      .order("practiced_at"),
    supabase
      .from("youtube_logs")
      .select("completed_at, youtube_videos(duration)")
      .eq("language", language)
      .order("completed_at"),
    supabase
      .from("ef_set_scores")
      .select(
        "id, tested_at, reading, listening, writing, speaking, cefr_level",
      )
      .order("tested_at", { ascending: false }),
  ]);

  const logs = (logsResult.data ?? []).map((l) => ({
    practiced_at: l.practiced_at,
    grammar_done_count: l.grammar_done_count ?? 0,
    expression_done_count: l.expression_done_count ?? 0,
    word_done_count: (l as { word_done_count?: number }).word_done_count ?? 0,
    speaking_count: (l as { speaking_count?: number }).speaking_count ?? 0,
  }));

  const youtubeLogs = (youtubeLogsResult.data ?? []).map((l) => ({
    completed_at: l.completed_at,
    youtube_videos:
      (l.youtube_videos as unknown as { duration: string | null } | null) ??
      null,
  }));

  const efSetScores: EfSetScore[] = (efSetResult.data ?? []) as EfSetScore[];

  return (
    <div className="w-full max-w-[980px]">
      <div
        className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--color-accent)" }}
      >
        Report
      </div>
      <h1 className="mb-[22px] text-[30px] font-bold text-foreground">
        Progress over time
      </h1>

      <div className="space-y-4">
        {/* EF SET は英語学習時のみ */}
        {isEn && <EfSetSection scores={efSetScores} />}
        <ReportCharts logs={logs} youtubeLogs={youtubeLogs} showWord={!isEn} />
      </div>
    </div>
  );
}
