"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@takaki/go-design-system";
import { incrementExpressionPlayCount } from "@/app/actions/practice";
import { useCurrentLanguage } from "@/lib/language-context";
import type { Expression } from "@/lib/types";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { RepeatingSession } from "@/components/repeating-session";
import { RepeatingPickerDialog } from "@/components/repeating-picker-dialog";
import { RepeatingCompleteModal } from "@/components/repeating-complete-modal";
import { RepeatingLeaveConfirm } from "@/components/repeating-leave-confirm";
import { useRepeatingSessionGuard } from "@/lib/hooks/use-repeating-session-guard";

type TodayStatus = {
  grammar: boolean;
  expression: boolean;
  word: boolean;
};

function CompletionNavButton({
  label,
  done,
  onClick,
}: {
  label: string;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={done ? "outline" : "default"}
      onClick={onClick}
      className="w-full justify-between"
    >
      <span className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)] shrink-0" />
        ) : (
          <ArrowRight className="h-4 w-4 shrink-0" />
        )}
        {label}
      </span>
      {done && (
        <span className="text-xs text-muted-foreground ml-2 shrink-0">
          Done today
        </span>
      )}
    </Button>
  );
}

export default function ExpressionRepeatingPage() {
  const router = useRouter();
  const supabase = createClient();
  const language = useCurrentLanguage();
  const searchParams = useSearchParams();
  const requestedCount = parseInt(searchParams.get("count") ?? "0", 10);
  const [allItems, setAllItems] = useState<Expression[]>([]);
  const [items, setItems] = useState<Expression[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentLine, setCurrentLine] = useState(-1);
  const [rate, setRate] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [todayStatus, setTodayStatus] = useState<TodayStatus>({
    grammar: false,
    expression: true,
    word: false,
  });
  const cancelRef = useRef(false);
  const userCancelledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resumeLineRef = useRef(0);
  const rateRef = useRef(rate);
  const pendingIncrementsRef = useRef<Promise<unknown>[]>([]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("expressions")
      .select("*")
      .eq("language", language)
      .lt("play_count", 10)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    setAllItems(data ?? []);
    setLoading(false);
  }, [language, supabase]);

  useEffect(() => {
    loadItems();
    return () => {
      cancelRef.current = true;
      audioRef.current?.pause();
    };
  }, [loadItems]);

  useEffect(() => {
    if (sessionStarted) return;
    if (loading) return;
    if (allItems.length === 0) return;
    if (requestedCount <= 0) return;
    startSession(Math.min(requestedCount, allItems.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, loading, sessionStarted, requestedCount]);

  function startSession(count: number) {
    setItems(allItems.slice(0, count));
    setIndex(0);
    setSessionStarted(true);
    setCompletedCount(0);
  }

  function restartSession() {
    setShowComplete(false);
    setSessionStarted(false);
    setIndex(0);
    setItems([]);
    setCompletedCount(0);
    resumeLineRef.current = 0;
    loadItems();
  }

  // Fetch today's completion status when the modal appears
  useEffect(() => {
    if (!showComplete) return;
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("practice_logs")
      .select("grammar_done_count, word_done_count")
      .eq("practiced_at", today)
      .eq("language", language)
      .maybeSingle()
      .then(({ data }) => {
        setTodayStatus({
          grammar: (data?.grammar_done_count ?? 0) > 0,
          expression: true, // just completed
          word: (data?.word_done_count ?? 0) > 0,
        });
      });
  }, [showComplete, language]);

  const stopSpeech = useCallback(() => {
    cancelRef.current = true;
    userCancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    setCurrentLine(-1);
  }, []);

  const speakLine = useCallback(
    async (
      text: string,
      lineIndex: number,
      speakRate: number,
    ): Promise<void> => {
      if (cancelRef.current) return;
      resumeLineRef.current = lineIndex;
      setCurrentLine(lineIndex);
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, rate: speakRate, language }),
        });
        if (!response.ok || cancelRef.current) return;
        const { audioContent } = await response.json();
        await new Promise<void>((resolve) => {
          if (cancelRef.current) {
            resolve();
            return;
          }
          const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
          audioRef.current = audio;
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      } catch {
        // continue on error
      }
    },
    [],
  );

  const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const handlePlay = useCallback(async () => {
    if (items.length === 0) return;
    cancelRef.current = false;
    userCancelledRef.current = false;
    setPlaying(true);

    let localItems = [...items];
    let localIndex = index;
    let startLine = resumeLineRef.current;

    try {
      // index から末尾まで順番に再生。途中停止→再開しても index は保持される
      // ので残りだけを再生し、セッションは必ず items.length 件ちょうどで終わる。
      while (localIndex < localItems.length && !cancelRef.current) {
        const item = localItems[localIndex];
        const lines = (item.conversation ?? "").split("\n").filter(Boolean);
        const fromLine = startLine;
        startLine = 0; // subsequent items always start from line 0

        for (let i = fromLine; i < lines.length; i++) {
          if (cancelRef.current) break;
          const ttsText = lines[i].replace(/^[AB]:\s*/i, "");
          await speakLine(ttsText, i, rateRef.current);
          if (i < lines.length - 1 && !cancelRef.current) {
            await pause(10);
          }
        }

        if (cancelRef.current) break;

        resumeLineRef.current = 0;
        setCurrentLine(-1);
        setCompletedCount((c) => c + 1);
        pendingIncrementsRef.current.push(
          incrementExpressionPlayCount(item.id).catch((e) => {
            console.error("[expression increment failed]", e);
          }),
        );

        // Update play_count locally for display only — never remove items mid-session
        localItems = localItems.map((it, idx) =>
          idx === localIndex ? { ...it, play_count: it.play_count + 1 } : it,
        );
        setItems([...localItems]);

        // 最終アイテムまで来たら終了（先頭へ巻き戻さない）
        if (localIndex >= localItems.length - 1) break;
        localIndex += 1;
        setIndex(localIndex);
        await pause(50);
      }
    } finally {
      setPlaying(false);
      setCurrentLine(-1);
      // 完了モーダルを先に表示してから increment の flush を待つ
      if (!userCancelledRef.current) {
        setShowComplete(true);
      }
      await Promise.allSettled(pendingIncrementsRef.current);
      pendingIncrementsRef.current = [];
    }
  }, [items, index, speakLine]);

  const guardActive = sessionStarted && !showComplete && completedCount > 0;
  const { pendingHref, confirmLeave, cancelLeave } = useRepeatingSessionGuard({
    active: guardActive,
    pendingPromisesRef: pendingIncrementsRef,
  });

  useEffect(() => {
    if (!sessionStarted || showComplete) return;
    const onKeydown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (playing) {
        stopSpeech();
      } else {
        handlePlay();
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [sessionStarted, showComplete, playing, handlePlay, stopSpeech]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  if (allItems.length === 0 && !showComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <p className="text-lg">練習中のフレーズはありません</p>
        <p className="text-sm">すべて完了しました！</p>
      </div>
    );
  }

  if (!sessionStarted) {
    return <RepeatingPickerDialog initialCategory="expression" />;
  }

  const current = items[index];
  if (!current) return null;
  const lines = current.conversation.split("\n").filter(Boolean);

  return (
    <>
      <RepeatingSession
        language={language}
        kindLabel="Phrase"
        title={current.expression}
        summary={current.meaning?.replace(/\\n/g, " ")}
        topicLabel={current.topic_label}
        topicIcon={current.topic_icon}
        lines={lines}
        currentLine={currentLine}
        wordNotes={language === "vi" ? current.word_notes : null}
        patternQuote={current.pattern_quote ?? current.expression}
        playCount={current.play_count}
        sessionCurrent={index + 1}
        sessionTotal={items.length}
        speed={rate}
        onSpeedChange={setRate}
        playing={playing}
        onPlay={handlePlay}
        onStop={stopSpeech}
        onPrev={() => {
          stopSpeech();
          resumeLineRef.current = 0;
          setIndex((i) => Math.max(0, i - 1));
        }}
        onNext={() => {
          stopSpeech();
          resumeLineRef.current = 0;
          setIndex((i) => Math.min(items.length - 1, i + 1));
        }}
        prevDisabled={index === 0 || playing}
        nextDisabled={index === items.length - 1 || playing}
        onExit={async () => {
          stopSpeech();
          await Promise.allSettled(pendingIncrementsRef.current);
          pendingIncrementsRef.current = [];
          router.push("/");
        }}
      />

      <RepeatingLeaveConfirm
        open={pendingHref !== null}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />

      <RepeatingCompleteModal
        open={showComplete}
        title="Nice work!"
        subtitle="You completed a round of Phrase Repeating"
        itemCount={items.length}
      >
        <CompletionNavButton
          label="Grammar Repeating"
          done={todayStatus.grammar}
          onClick={() => router.push("/repeating/grammar")}
        />
        <CompletionNavButton
          label="Phrase Repeating"
          done={todayStatus.expression}
          onClick={restartSession}
        />
        {language === "vi" && (
          <CompletionNavButton
            label="Word Repeating"
            done={todayStatus.word}
            onClick={() => router.push("/repeating/word")}
          />
        )}
        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="w-full text-muted-foreground"
        >
          Back to Dashboard
        </Button>
      </RepeatingCompleteModal>
    </>
  );
}
