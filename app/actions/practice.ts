"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getCurrentLanguage } from "@/lib/language";
import type { Language, WordNote, ItemTopic } from "@/lib/types";
import { revalidatePath } from "next/cache";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const REGEN_SYSTEM_PROMPT = `You are regenerating word_notes (Japanese glosses) for a Vietnamese learning entry.

INPUT shape:
- Target: the main word / phrase / grammar pattern
- Dialogue: A/B/A 3-turn dialogue lines (each prefixed with "A: " or "B: ")

TASK: produce a comprehensive word_notes array covering EVERY non-trivial word from BOTH the target itself and ALL dialogue lines.

★最重要ルール★
- 1行目だけカバーしてある word_notes は不合格。A/B/A 全行に登場する単語を網羅すること。
- 数詞・量詞（hai mươi / ba / một / ngàn / ký 等）も必ず含める。
- 程度副詞（quá / lắm 等）と感嘆助詞（nhé / nha / ạ / à 等）も含める。
- ターゲットそのもの（語/パターン）の構成語も入れる。

その他:
- Multi-word fixed units (cảm ơn / phải không / không phải là / rất vui được gặp bạn 等) は1エントリにまとめる。
- 各エントリは { word, note }。note は ~20文字の短い日本語注釈。
- 重複させない（同じ語は1回だけ）。
- 順番: ターゲット語の構成要素 → ダイアログ出現順 (A → B → A)。
- スキップして良いのは: 構造プレースホルダ (S/V/O, 名詞/動詞/形容詞), 個人名（Takaki, Anna 等の固有名）, 自明な英語/日本語借用語のみ。
- 通常 6〜15 エントリ。少なすぎたら見直すこと。

Return ONLY the word_notes array via the tool. No extra text.`;

const REGEN_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    word_notes: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          word: { type: "string" as const },
          note: { type: "string" as const },
        },
        required: ["word", "note"],
      },
    },
  },
  required: ["word_notes"],
};

// 単語用: 対話(example) + word_notes を一緒に再生成する
const WORD_REGEN_SYSTEM_PROMPT = `You are regenerating the example dialogue AND word_notes for a Vietnamese vocabulary entry (CEFR A1 learner).

INPUT shape:
- Target: the vocabulary word (Vietnamese) + its Japanese meaning
- KNOWN_VOCAB: words the learner already knows (use these PLUS the target word in the dialogue; do not introduce unfamiliar words)

TASK: produce
1) "example": a natural A/B/A 3-turn dialogue (2-3 turns, max 4 lines) using the target word at least once. Each line starts with "A: " or "B: ". Each line ≤ 8 words. 南部ベトナム語 (Southern / Saigon) で書く — ユーザーはホーチミン市在住。北部 (ハノイ) 方言は使わない。南部語彙 (mắc / ký / ba / má / xe hơi 等) と南部語尾 (nha / nghen) を優先。極端なスラングは避ける。
   自然でフランクな日常会話にする。一人称 "tôi" は日常会話では使わない — 相手との関係で代名詞を選ぶ (同年代=mình、年上に対して自分=em・相手=anh/chị、年下に対して自分=anh/chị・相手=em)。教科書的な堅い言い回しは避ける。
2) "word_notes": Japanese glosses covering EVERY non-trivial word from the dialogue, plus the target word itself.

word_notes rules:
- 1行目だけカバーは不合格。A/B/A 全行に登場する単語を必ず網羅。
- 数詞・量詞 (một / hai / ngàn / ký 等), 程度副詞 (quá / lắm 等), 感嘆助詞 (nhé / nha / ạ / à 等) も含める。
- Multi-word fixed units (cảm ơn 等) は1エントリ。
- note は ~20文字の短い日本語注釈。
- 順番: ターゲット → ダイアログ出現順。
- 重複させない。
- スキップ可: 構造プレースホルダ, 個人名, 自明な英語/日本語借用語のみ。
- 通常 6〜12 エントリ。

Return ONLY via the tool.`;

const WORD_REGEN_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    example: {
      type: "string" as const,
      description:
        "A/B/A 3-turn dialogue lines joined by '\\n'. Each line starts with 'A: ' or 'B: '.",
    },
    word_notes: REGEN_TOOL_SCHEMA.properties.word_notes,
  },
  required: ["example", "word_notes"],
};

// VI 用のコア語彙（extract API と同じセット）
const CORE_VI_VOCAB_REGEN = [
  "tôi",
  "bạn",
  "anh",
  "chị",
  "em",
  "cô",
  "chú",
  "là",
  "không",
  "có",
  "vâng",
  "dạ",
  "xin chào",
  "cảm ơn",
  "xin lỗi",
  "đi",
  "ăn",
  "uống",
  "muốn",
  "thích",
  "biết",
  "hiểu",
  "nói",
  "làm",
  "ở",
  "đến",
  "từ",
  "này",
  "kia",
  "gì",
  "ai",
  "đâu",
  "khi nào",
  "bao nhiêu",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "cơm",
  "phở",
  "cà phê",
  "nước",
  "hôm nay",
  "ngày mai",
  "bây giờ",
  "rất",
  "nhiều",
  "ít",
  "tốt",
  "việt nam",
  "nhật bản",
];

export async function regenerateWordNotes(
  itemType: "grammar" | "expression" | "word",
  id: string,
): Promise<WordNote[]> {
  const supabase = await createClient();

  // ── word の場合: 対話 + word_notes を一緒に再生成 ──
  if (itemType === "word") {
    const { data: word } = await supabase
      .from("words")
      .select("word, meaning, language")
      .eq("id", id)
      .single();
    if (!word) throw new Error("word not found");

    // 既登録の語彙を KNOWN_VOCAB として渡す（対話を学習者の知識内に保つ）
    const { data: existingWords } = await supabase
      .from("words")
      .select("word")
      .eq("language", word.language);
    const knownVocab = Array.from(
      new Set([
        ...CORE_VI_VOCAB_REGEN,
        ...((existingWords ?? []) as { word: string }[]).map((w) =>
          w.word.toLowerCase(),
        ),
      ]),
    );

    const userMessage = `Target word: ${word.word}
Meaning: ${word.meaning}

KNOWN_VOCAB (use ONLY these in the dialogue plus the target word itself):
${JSON.stringify(knownVocab)}

Generate the example dialogue and word_notes per the system rules.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: WORD_REGEN_SYSTEM_PROMPT,
      tools: [
        {
          name: "save_word_content",
          description: "Save the regenerated example dialogue and word_notes.",
          input_schema: WORD_REGEN_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "save_word_content" },
      messages: [{ role: "user", content: userMessage }],
    });

    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("AI response did not include tool_use");
    }
    const { example, word_notes } = toolUse.input as {
      example: string;
      word_notes: WordNote[];
    };

    const { error } = await supabase
      .from("words")
      .update({ example, word_notes })
      .eq("id", id);
    if (error) throw error;

    revalidatePath("/list");
    return word_notes;
  }

  // ── grammar / expression の場合: word_notes のみ再生成 ──
  let targetText = "";
  let dialogue = "";

  if (itemType === "grammar") {
    const { data } = await supabase
      .from("grammar")
      .select("name, examples")
      .eq("id", id)
      .single();
    if (!data) throw new Error("grammar not found");
    targetText = data.name as string;
    dialogue = (data.examples as string) ?? "";
  } else {
    const { data } = await supabase
      .from("expressions")
      .select("expression, conversation")
      .eq("id", id)
      .single();
    if (!data) throw new Error("expression not found");
    targetText = data.expression as string;
    dialogue = (data.conversation as string) ?? "";
  }

  const userMessage = `Target: ${targetText}

Dialogue lines:
${dialogue || "(no dialogue available; produce word_notes covering only the target)"}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: REGEN_SYSTEM_PROMPT,
    tools: [
      {
        name: "save_word_notes",
        description: "Save the regenerated word_notes for the entry.",
        input_schema: REGEN_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "save_word_notes" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI response did not include tool_use");
  }
  const { word_notes } = toolUse.input as { word_notes: WordNote[] };

  const table = itemType === "grammar" ? "grammar" : "expressions";
  const { error } = await supabase
    .from(table)
    .update({ word_notes })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/list");
  return word_notes;
}

export async function incrementGrammarPlayCount(id: string) {
  const supabase = await createClient();

  const { data: grammar } = await supabase
    .from("grammar")
    .select("play_count, lesson_id, language")
    .eq("id", id)
    .single();

  if (!grammar) return;

  await supabase
    .from("grammar")
    .update({
      play_count: grammar.play_count + 1,
      last_played_at: new Date().toISOString().split("T")[0],
    })
    .eq("id", id);

  await upsertPracticeLog((grammar.language as Language) ?? "en", "grammar");
  await syncLessonStatus(grammar.lesson_id);
  revalidatePath("/");
  revalidatePath("/texts");
  revalidatePath("/lessons");
}

export async function incrementExpressionPlayCount(id: string) {
  const supabase = await createClient();

  const { data: expression } = await supabase
    .from("expressions")
    .select("play_count, lesson_id, language")
    .eq("id", id)
    .single();

  if (!expression) return;

  await supabase
    .from("expressions")
    .update({
      play_count: expression.play_count + 1,
      last_played_at: new Date().toISOString().split("T")[0],
    })
    .eq("id", id);

  await upsertPracticeLog(
    (expression.language as Language) ?? "en",
    "expression",
  );
  await syncLessonStatus(expression.lesson_id);
  revalidatePath("/");
  revalidatePath("/texts");
  revalidatePath("/lessons");
}

export async function incrementWordPlayCount(id: string) {
  const supabase = await createClient();

  const { data: word } = await supabase
    .from("words")
    .select("play_count, lesson_id, language")
    .eq("id", id)
    .single();

  if (!word) return;

  await supabase
    .from("words")
    .update({
      play_count: word.play_count + 1,
      last_played_at: new Date().toISOString().split("T")[0],
    })
    .eq("id", id);

  await upsertPracticeLog((word.language as Language) ?? "en", "word");
  await syncLessonStatus(word.lesson_id);
  revalidatePath("/");
  revalidatePath("/texts");
  revalidatePath("/lessons");
}

async function syncLessonStatus(lessonId: string | null) {
  if (!lessonId) return;
  const supabase = await createClient();

  const [{ data: grammars }, { data: expressions }, { data: words }] =
    await Promise.all([
      supabase.from("grammar").select("play_count").eq("lesson_id", lessonId),
      supabase
        .from("expressions")
        .select("play_count")
        .eq("lesson_id", lessonId),
      supabase.from("words").select("play_count").eq("lesson_id", lessonId),
    ]);

  const total =
    (grammars?.length ?? 0) + (expressions?.length ?? 0) + (words?.length ?? 0);
  if (total === 0) return;

  const allDone =
    (grammars ?? []).every((g) => g.play_count >= 10) &&
    (expressions ?? []).every((e) => e.play_count >= 10) &&
    (words ?? []).every((w) => w.play_count >= 10);

  await supabase
    .from("lessons")
    .update({ status: allDone ? "習得済み" : "練習中" })
    .eq("id", lessonId);
}

async function upsertPracticeLog(
  language: Language,
  kind: "grammar" | "expression" | "word",
) {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("practice_logs")
    .select("grammar_done_count, expression_done_count, word_done_count")
    .eq("practiced_at", today)
    .eq("language", language)
    .maybeSingle();

  await supabase.from("practice_logs").upsert(
    {
      practiced_at: today,
      language,
      grammar_done_count:
        (existing?.grammar_done_count ?? 0) + (kind === "grammar" ? 1 : 0),
      expression_done_count:
        (existing?.expression_done_count ?? 0) +
        (kind === "expression" ? 1 : 0),
      word_done_count:
        (existing?.word_done_count ?? 0) + (kind === "word" ? 1 : 0),
    },
    { onConflict: "practiced_at,language" },
  );
}

export async function saveGrammar(
  grammar: {
    name: string;
    summary: string;
    detail?: string | null;
    examples: string[];
    pattern_quote?: string | null;
    usage_scene: string;
    word_notes?: WordNote[] | null;
    category?: string | null;
    source_title?: string | null;
    topic?: ItemTopic | null;
  }[],
  lessonId?: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const language = await getCurrentLanguage();

  const rows = grammar.map((g) => ({
    name: g.name,
    summary: g.summary,
    detail: g.detail ?? null,
    examples: g.examples.join("\n"),
    usage_scene: g.usage_scene,
    play_count: 0,
    lesson_id: lessonId ?? null,
    language,
    word_notes: g.word_notes ?? null,
    category: g.category ?? null,
    source_title: g.source_title ?? null,
    topic_label: g.topic?.label ?? null,
    topic_icon: g.topic?.icon ?? null,
    pattern_quote: g.pattern_quote ?? null,
  }));

  const { data, error } = await supabase
    .from("grammar")
    .insert(rows)
    .select("id, name");
  if (error) throw error;
  revalidatePath("/list");
  revalidatePath("/texts");
  return data ?? [];
}

export async function saveExpressions(
  expressions: {
    category: string;
    expression: string;
    meaning: string;
    conversation: string[];
    usage_scene: string;
    word_notes?: WordNote[] | null;
    nuance?: string | null;
    pattern_quote?: string | null;
    source_title?: string | null;
    topic?: ItemTopic | null;
  }[],
  lessonId?: string,
) {
  const supabase = await createClient();
  const language = await getCurrentLanguage();

  const rows = expressions.map((e) => ({
    category: e.category,
    expression: e.expression,
    meaning: e.meaning,
    conversation: e.conversation.join("\n"),
    usage_scene: e.usage_scene,
    play_count: 0,
    lesson_id: lessonId ?? null,
    language,
    word_notes: e.word_notes ?? null,
    nuance: e.nuance ?? null,
    source_title: e.source_title ?? null,
    topic_label: e.topic?.label ?? null,
    topic_icon: e.topic?.icon ?? null,
    pattern_quote: e.pattern_quote ?? null,
  }));

  const { error } = await supabase.from("expressions").insert(rows);
  if (error) throw error;
  revalidatePath("/list");
  revalidatePath("/texts");
  revalidatePath("/phrases");
}

export async function saveWords(
  words: {
    word: string;
    meaning: string;
    example?: string | null;
    usage_scene?: string | null;
    word_notes?: WordNote[] | null;
    source_title?: string | null;
    category?: string | null;
    topic?: ItemTopic | null;
  }[],
  lessonId?: string,
): Promise<{ inserted: number; skipped: number }> {
  const supabase = await createClient();
  const language = await getCurrentLanguage();

  // 既存単語を取得して重複（大文字小文字無視）を除外
  const { data: existing } = await supabase
    .from("words")
    .select("word")
    .eq("language", language);
  const existingSet = new Set(
    (existing ?? []).map((e) => (e.word as string).toLowerCase()),
  );

  const filtered = words.filter((w) => !existingSet.has(w.word.toLowerCase()));
  const skipped = words.length - filtered.length;
  if (filtered.length === 0) {
    return { inserted: 0, skipped };
  }

  const rows = filtered.map((w) => ({
    word: w.word,
    meaning: w.meaning,
    example: w.example ?? null,
    usage_scene: w.usage_scene ?? null,
    play_count: 0,
    lesson_id: lessonId ?? null,
    language,
    word_notes: w.word_notes ?? null,
    source_title: w.source_title ?? null,
    category: w.category ?? null,
    topic_label: w.topic?.label ?? null,
    topic_icon: w.topic?.icon ?? null,
  }));

  const { error } = await supabase.from("words").insert(rows);
  if (error) throw error;
  revalidatePath("/list");
  revalidatePath("/phrases");
  return { inserted: filtered.length, skipped };
}

export async function deleteWord(id: string) {
  const supabase = await createClient();
  const { data: word } = await supabase
    .from("words")
    .select("lesson_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("words").delete().eq("id", id);
  if (error) throw error;
  await syncLessonStatus(word?.lesson_id ?? null);
  revalidatePath("/list");
}

// ── 場面タグ（category）─ ライブラリで手動設定。/phrases の場面チップに使う ──
type ItemKind = "grammar" | "expression" | "word";
const ITEM_TABLE: Record<ItemKind, string> = {
  grammar: "grammar",
  expression: "expressions",
  word: "words",
};

export async function setItemCategory(
  kind: ItemKind,
  id: string,
  category: string,
) {
  const supabase = await createClient();
  const trimmed = category.trim();
  // expressions.category は NOT NULL なのでクリア時は空文字を保存。
  // grammar / words は nullable なので null にする。
  const value = kind === "expression" ? trimmed : trimmed || null;
  const { error } = await supabase
    .from(ITEM_TABLE[kind])
    .update({ category: value })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/list");
  revalidatePath("/phrases");
}

// ── メモ（note）─ 理解のための自由メモ。ライブラリで入力/編集/削除 ──
export async function setItemNote(kind: ItemKind, id: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(ITEM_TABLE[kind])
    .update({ note: note.trim() || null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/list");
}

// ── パターン箇所の AI 判定 ──────────────────────────────────────────────
const PATTERN_DETECT_SYSTEM = `You locate where a grammar pattern (or fixed expression) actually appears inside a short dialogue, so the app can highlight it.

You are given PATTERN and DIALOGUE (2-4 lines, each starting with "A: " or "B: ").
Return ONLY the exact contiguous substring — copied verbatim (identical characters, spacing, accents, casing) from ONE dialogue line — that is the concrete realization of the pattern in that dialogue.
- It MUST be an exact substring of a single line's text (excluding the "A:"/"B:" prefix).
- Output ONLY that substring. No quotes, no labels, no explanation.
- If the pattern genuinely does not appear, output exactly: NONE`;

export async function detectPatternQuote(
  kind: "grammar" | "expression",
  id: string,
): Promise<string | null> {
  const supabase = await createClient();
  const table = kind === "grammar" ? "grammar" : "expressions";
  const { data } = await supabase
    .from(table)
    .select(kind === "grammar" ? "name, examples" : "expression, conversation")
    .eq("id", id)
    .single();
  if (!data) return null;
  const row = data as Record<string, string | null>;
  const pattern = kind === "grammar" ? row.name : row.expression;
  const dialogue = kind === "grammar" ? row.examples : row.conversation;
  if (!pattern || !dialogue) return null;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: PATTERN_DETECT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `PATTERN: ${pattern}\n\nDIALOGUE:\n${dialogue}`,
      },
    ],
  });
  const block = message.content.find((c) => c.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";

  // 各行（A:/B: プレフィックス除去）の部分文字列として実在するか検証
  const lines = dialogue
    .split("\n")
    .map((l) => l.replace(/^[AB]:\s*/i, "").trim())
    .filter(Boolean);
  const quote = raw && raw !== "NONE" && lines.some((l) => l.includes(raw))
    ? raw
    : null;

  await supabase.from(table).update({ pattern_quote: quote }).eq("id", id);
  revalidatePath("/list");
  return quote;
}

export async function toggleUnderstood(
  kind: "grammar" | "expression",
  id: string,
  next: boolean,
): Promise<void> {
  const supabase = await createClient();
  const table = kind === "grammar" ? "grammar" : "expressions";
  const { error } = await supabase
    .from(table)
    .update({ understood: next })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/list");
  revalidatePath("/library");
}

export async function toggleRound(
  kind: "grammar" | "expression",
  id: string,
  round: 1 | 2 | 3,
  next: boolean,
): Promise<void> {
  const supabase = await createClient();
  const table = kind === "grammar" ? "grammar" : "expressions";
  const column = `round${round}_done`;
  const { error } = await supabase
    .from(table)
    .update({ [column]: next })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/library");
  revalidatePath("/");
}

export async function upsertNativeCampLog(
  date: string,
  count: number,
): Promise<{ error?: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です" };

  const { data: existing } = await supabase
    .from("native_camp_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("logged_at", date)
    .maybeSingle();

  let error;
  if (existing) {
    const result = await supabase
      .from("native_camp_logs")
      .update({ count })
      .eq("id", existing.id);
    error = result.error;
  } else {
    const result = await supabase
      .from("native_camp_logs")
      .insert({ user_id: user.id, logged_at: date, count });
    error = result.error;
  }

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/report");
  return null;
}

export async function deleteGrammar(id: string) {
  const supabase = await createClient();
  const { data: grammar } = await supabase
    .from("grammar")
    .select("lesson_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("grammar").delete().eq("id", id);
  if (error) throw error;
  await syncLessonStatus(grammar?.lesson_id ?? null);
  revalidatePath("/list");
  revalidatePath("/texts");
}

export async function deleteExpression(id: string) {
  const supabase = await createClient();
  const { data: expression } = await supabase
    .from("expressions")
    .select("lesson_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("expressions").delete().eq("id", id);
  if (error) throw error;
  await syncLessonStatus(expression?.lesson_id ?? null);
  revalidatePath("/list");
  revalidatePath("/texts");
}

export async function updateLessonStatus(
  id: string,
  status: "未登録" | "練習中" | "習得済み",
) {
  const supabase = await createClient();
  await supabase.from("lessons").update({ status }).eq("id", id);
  revalidatePath("/lessons");
  revalidatePath("/texts");
}

export async function saveLessons(
  level: number,
  items: { lesson_no: string; topic: string }[],
): Promise<{ inserted: number; skipped: number }> {
  const supabase = await createClient();
  const language = await getCurrentLanguage();

  const { data: existing } = await supabase
    .from("lessons")
    .select("lesson_no")
    .eq("level", level)
    .eq("language", language);

  const existingNos = new Set((existing ?? []).map((l) => l.lesson_no));
  const newRows = items
    .filter((i) => i.lesson_no && i.topic && !existingNos.has(i.lesson_no))
    .map((i) => ({
      level,
      lesson_no: i.lesson_no,
      topic: i.topic,
      status: "未登録" as const,
      language,
    }));

  if (newRows.length > 0) {
    const { error } = await supabase.from("lessons").insert(newRows);
    if (error) throw error;
  }

  revalidatePath("/texts");
  revalidatePath("/lessons");
  return { inserted: newRows.length, skipped: items.length - newRows.length };
}
