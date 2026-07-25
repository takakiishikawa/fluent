import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import { ReportCharts } from "@/components/report-charts";

export default async function ReportPage() {
  const supabase = await createClient();
  const language = await getCurrentLanguage();
  const isEn = language === "en";

  const [
    logsResult,
    youtubeLogsResult,
    outputTopicsResult,
    inputRoundsResult,
    songsResult,
  ] = await Promise.all([
    supabase
      .from("practice_logs")
      .select(
        "practiced_at, grammar_done_count, expression_done_count, word_done_count, speaking_count",
      )
      .eq("language", language)
      .order("practiced_at"),
    supabase
      .from("youtube_logs")
      .select("completed_at, duration")
      .eq("language", language)
      .order("completed_at"),
    supabase
      .from("output_topics")
      .select("responses, updated_at")
      .eq("language", language),
    isEn
      ? (async () => {
          const [g, e] = await Promise.all([
            supabase
              .from("grammar")
              .select("rounds_updated_at")
              .eq("language", "en")
              .not("rounds_updated_at", "is", null),
            supabase
              .from("expressions")
              .select("rounds_updated_at")
              .eq("language", "en")
              .not("rounds_updated_at", "is", null),
          ]);
          return { data: [...(g.data ?? []), ...(e.data ?? [])] };
        })()
      : Promise.resolve({ data: [] as { rounds_updated_at: string }[] }),
    isEn
      ? supabase.from("songs").select("lines, updated_at").eq("language", "en")
      : Promise.resolve({ data: [] }),
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
    duration: l.duration as string | null,
  }));

  const outputTopics = (outputTopicsResult.data ?? []) as {
    responses: string[];
    updated_at: string;
  }[];

  const inputRounds = (inputRoundsResult.data ?? []) as {
    rounds_updated_at: string;
  }[];

  const songs = (songsResult.data ?? []) as {
    lines: { reviewed: boolean }[];
    updated_at: string;
  }[];

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

      <ReportCharts
        logs={logs}
        youtubeLogs={youtubeLogs}
        outputTopics={outputTopics}
        inputRounds={inputRounds}
        songs={songs}
        showWord={!isEn}
        showInputAndSongs={isEn}
        shadowingLabel={isEn ? "Ryan" : "Shadowing"}
      />
    </div>
  );
}
