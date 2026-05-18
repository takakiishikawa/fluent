import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { pickAnglesEN } from "@/lib/life-angles";

export const maxDuration = 120;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// JSONSchema for Anthropic tool_use. Keeps Vietnamese-only fields optional
// so EN extraction can also use the same tool without forcing them.
const WORD_NOTES_SCHEMA = {
  type: "array" as const,
  description:
    "Per-word Japanese gloss covering BOTH the main pattern/expression AND words used in the example dialogue (deduplicated).",
  items: {
    type: "object" as const,
    properties: {
      word: { type: "string" as const },
      note: { type: "string" as const },
    },
    required: ["word", "note"],
  },
};

// Conversation topic shown as a chip on the repeating screen.
export const TOPIC_ICONS = [
  "chef-hat",
  "briefcase",
  "plane",
  "heart",
  "book-open",
  "coffee",
  "shopping-bag",
  "home",
  "dumbbell",
  "code",
  "cat",
  "dog",
  "bike",
  "utensils",
  "music",
  "users",
  "map-pin",
  "wallet",
  "shirt",
  "brain",
  "sparkles",
  "message-circle",
] as const;

const TOPIC_SCHEMA = {
  type: "object" as const,
  description:
    "The subject of the example conversation, shown as a chip on the practice screen.",
  properties: {
    label: {
      type: "string" as const,
      description:
        'Short English label, 1-2 words (例: "Cooking", "Product work", "Dating", "Café", "Reading").',
    },
    icon: {
      type: "string" as const,
      enum: [...TOPIC_ICONS],
      description: "lucide-react icon name best matching the topic.",
    },
  },
  required: ["label", "icon"],
};

const EXTRACT_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    source_title: {
      type: ["string", "null"] as const,
      description:
        "VI only. Title at the top of the pasted material (例: 'TRIAL LESSON - HOMEWORK', 'Lesson 2: Shopping at a Vietnamese Market'). null if not present.",
    },
    grammar: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          category: {
            type: "string" as const,
            description:
              "Japanese category label (例: 文型, 代名詞, 否定, 疑問, 助詞). VI only; omit for EN.",
          },
          name: { type: "string" as const },
          summary: { type: "string" as const },
          detail: { type: ["string", "null"] as const },
          examples: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "A/B/A 3-turn dialogue lines, max 4.",
          },
          usage_scene: { type: "string" as const },
          frequency: {
            type: "integer" as const,
            minimum: 1,
            maximum: 5,
          },
          word_notes: WORD_NOTES_SCHEMA,
          topic: TOPIC_SCHEMA,
          pattern_quote: {
            type: "string" as const,
            description:
              "The exact contiguous substring, copied verbatim from one of the examples lines, that is the concrete instance of this grammar pattern. MUST be an exact substring of a line so the UI can highlight it.",
          },
        },
        required: [
          "name",
          "summary",
          "examples",
          "usage_scene",
          "frequency",
          "topic",
          "pattern_quote",
        ],
      },
    },
    expressions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          category: { type: "string" as const },
          expression: { type: "string" as const },
          meaning: { type: "string" as const },
          conversation: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "A/B/A 3-turn dialogue lines, max 4.",
          },
          usage_scene: { type: "string" as const },
          frequency: {
            type: "integer" as const,
            minimum: 1,
            maximum: 5,
          },
          word_notes: WORD_NOTES_SCHEMA,
          topic: TOPIC_SCHEMA,
          pattern_quote: {
            type: "string" as const,
            description:
              "The exact contiguous substring, copied verbatim from one of the conversation lines, where this expression is actually used (it may be inflected or slightly varied). MUST be an exact substring of a line so the UI can highlight it.",
          },
          nuance: {
            type: ["string", "null"] as const,
            description:
              "1-2 Japanese sentences on how the phrase comes across (politeness/register). VI only.",
          },
        },
        required: [
          "category",
          "expression",
          "meaning",
          "conversation",
          "usage_scene",
          "frequency",
          "topic",
          "pattern_quote",
        ],
      },
    },
    words: {
      type: "array" as const,
      description:
        "VI only. Individual vocabulary entries (single words or inseparable compounds).",
      items: {
        type: "object" as const,
        properties: {
          category: {
            type: "string" as const,
            description:
              "Japanese category label (例: 肉, 魚介, 野菜・果物, 食品, 通貨・単位, 形容詞, 呼称, 動詞, 名詞 etc.). VI only.",
          },
          word: { type: "string" as const },
          meaning: { type: "string" as const },
          example: {
            type: ["string", "null"] as const,
            description:
              "A/B/A 3-turn dialogue lines joined by '\\n', max 4 lines, each line starts with 'A: ' or 'B: '. Same format as grammar.examples / expressions.conversation. The target word must appear at least once in the dialogue.",
          },
          usage_scene: { type: ["string", "null"] as const },
          frequency: {
            type: "integer" as const,
            minimum: 1,
            maximum: 5,
          },
          word_notes: WORD_NOTES_SCHEMA,
          topic: TOPIC_SCHEMA,
        },
        required: ["word", "meaning", "frequency", "topic"],
      },
    },
  },
  required: ["grammar", "expressions"],
};

const SYSTEM_PROMPT_EN = `You are an English learning assistant. Extract grammar points and expressions from Native Camp lesson materials.

User context: Takaki, 32-year-old Japanese male, lives alone in Ho Chi Minh City District 1-3 (Vietnam, 2-3 years), Product Manager at Sun Asterisk managing B2B recruitment platform and B2C education LMS, team of ~20 (engineers/QA/designers/BrSE). INTJ personality.

His life has many sides — examples should rotate across these, not stay in one corner:
- Body & routine: strength training (bulking 70kg→80kg, bench/pull-ups/squat/RDL), meditation, occasional massages for self-care, walks/strolls (often thinks while walking).
- Home & making things: home cooking and meal-prep with friends, very into ものづくり (making things by hand), sews his own clothes, believes "being able to make things yourself makes life richer" — applies to cooking, clothes, software.
- Animals & cafes: cats (wants a British Shorthair, visits CATFE/KIN NEKO), recently came to like dogs too, cafe hopping around District 1-3.
- Reading & media: Korean dramas on Netflix, started reading novels and essays (Haruki Murakami).
- Social & dating: values relationships with people more than before, goes on dates with women, regularly attends product/tech meetups in Ho Chi Minh.
- Money & values: realized the importance of saving / frugality, but also became interested in spending money intentionally (experiences), thinks asset-building is quite important.
- Work & career: PdM role has shifted toward more upstream/strategic work, enjoys building AI side projects as an individual developer, feels AI is changing how products get built, considers working in another country in the future.
- Living abroad & culture: lives abroad in Vietnam — notices cultural differences (food, work styles, social norms) vs Japan, appreciates Vietnamese street food / coffee / eating with coworkers, navigates the Vietnamese language as a foreigner, occasional culture shock and unexpected kindness from locals, lower cost of living enables a different lifestyle, thinks about identity and what "home" means after years abroad, compares Tokyo vs Ho Chi Minh life (pace/density/weather/people).
- Place & vehicle: Ho Chi Minh District 1-3, rides motorbike.
- Mind: philosophy / CBT / AI / product thinking.

Return a JSON object with exactly this structure:
{
  "grammar": [
    {
      "name": "grammar name",
      "summary": "brief Japanese explanation",
      "detail": "detailed explanation if needed (or null)",
      "examples": ["A: ...", "B: ...", "A: ..."],
      "usage_scene": "when to use this grammar",
      "frequency": 3
    }
  ],
  "expressions": [
    {
      "category": "category (e.g., 相槌・反応, 提案, 謝罪, etc.)",
      "expression": "the expression",
      "meaning": "Japanese meaning",
      "conversation": ["A: ...", "B: ...", "A: ..."],
      "usage_scene": "when to use this expression",
      "frequency": 3
    }
  ]
}

Rules:
- grammar: extract only the grammar themes actually covered in the lesson material — typically 1 to 3 items. Do NOT pad to a fixed count.
- frequency is 1-5 stars based on how commonly useful this is for Takaki
- Both "examples" (grammar) and "conversation" (expressions) MUST be A/B/A 3-turn format, maximum 4 lines
- All lines MUST start with exactly "A: " or "B: " prefixes
- Personalize to Takaki's life by ROTATING across the angles above. Do NOT default to cafe / cats / gym every time — actively pull from cooking, sewing, ものづくり, walks, dogs, dating, reading novels, AI side projects, upstream PdM work, asset-building, HCMC meetups, living-abroad / Japan-vs-Vietnam culture, etc. Different items in the same response MUST use different angles.
- If the user message contains a PRIORITY_ANGLES block, treat those listed angles as the dominant context for THIS run. Distribute them across items so that no two items reuse the same angle. Other angles may appear as supporting detail only.
- Use Ho Chi Minh locations naturally (District 3, Nguyen Trai, Thao Dien, etc.) when geographically relevant — but don't force a location into every line.
- Natural conversational tone (not too formal, not too casual)
- detail can be null if summary is sufficient
- word_notes: for each grammar / expression, list the harder words from the dialogue (roughly B1+ — words a Japanese intermediate learner may not know) with a short Japanese gloss, as { word, note }. Around 4-8 entries. Skip trivial words (the, is, you, etc.). Used to show inline glosses while practicing.

TOPIC (each item — required):
- For every grammar / expression item, also set "topic": the subject of the example conversation you wrote for it.
- topic.label: a short English label, 1-2 words (例: "Cooking", "Product work", "Dating", "Café", "Reading", "Money", "Fitness", "Pets"). English only.
- topic.icon: pick the single best-matching icon name from this fixed list — [chef-hat, briefcase, plane, heart, book-open, coffee, shopping-bag, home, dumbbell, code, cat, dog, bike, utensils, music, users, map-pin, wallet, shirt, brain, sparkles, message-circle]. Use "message-circle" only when nothing else fits.

PATTERN HIGHLIGHT (grammar & expression items — required):
- pattern_quote: copy verbatim the exact run of words FROM one dialogue line where the pattern/expression actually occurs (grammar → examples, expression → conversation). It MUST be an exact substring of a line so the UI can highlight it. The expression may be inflected or slightly varied in the dialogue — quote it exactly as it appears there.
- Return ONLY valid JSON, no markdown, no explanation`;

const SYSTEM_PROMPT_VI = `You are a Vietnamese language tutor for an absolute beginner (CEFR A1).

User context: Takaki, 32, Japanese male, lives in Ho Chi Minh City. He takes weekly 1-on-1 Vietnamese lessons on Preply and wants to register exactly what each lesson covers into his practice app. He stays at CEFR A1 — greetings, basic verbs, pronouns, numbers, food, time. ~15 min/day practice.

★DIALECT (最重要) — 南部ベトナム語 (Southern / Saigon / Ho Chi Minh) で生成すること★
- ユーザーはホーチミン市在住。語彙・表現・対話・example・word_notes はすべて南部方言で書く。北部 (ハノイ) 方言は使わない。
- 南部語彙を既定として優先する。例: 高い=mắc (北 đắt), キロ=ký (北 cân), 父=ba (北 bố), 母=má (北 mẹ), 車=xe hơi (北 ô tô), 茶碗/丼=chén・tô (北 bát), スプーン=muỗng (北 thìa), コップ=ly (北 cốc), パイナップル=thơm・khóm (北 dứa)。
- 南部の語尾・口語を使う: nha / nghen / hen / á (北部の nhé / nhỉ は使わない)。
- ただし学習者は A1。通じやすい標準的な南部語にとどめ、極端なスラングは避ける。
- word_notes の note (日本語訳) で南北で語が異なる場合は南部語であることが分かるように書いてよい。
- 入力素材に北部語が含まれていても、登録する name / expression / word / 対話は南部語に置き換える。

INPUT FORMAT: the user pastes lesson material from Preply (vocabulary tables, sentence-structure tables, exercises, dialogues). The text MAY include a title like "TRIAL LESSON - HOMEWORK" or "Lesson 2: Shopping at a Vietnamese Market" — extract that into source_title verbatim. If no clear title, return null.

Your job: classify every distinct learning item from the input into ONE of three categories:
- "grammar" — a structural rule, particle, or sentence pattern with a placeholder (e.g. "Subject + là + Noun", "có ... không?", "Chào + [Name/Pronoun]")
- "expressions" — a fully-formed fixed phrase / greeting / set expression with NO placeholder (e.g. "Cảm ơn", "Bạn khỏe không?", "Rất vui được gặp bạn", "Mắc quá!")
- "words" — a single word or inseparable compound (e.g. "thịt heo", "tươi", "cảm ơn" used as a standalone vocab entry)

CATEGORY BOUNDARIES (重要):
- A multi-word fixed expression like "Rất vui được gặp bạn" is an EXPRESSION, not a word.
- A pattern with [placeholder] like "Cho + subject + [quantity] + [item]" is a GRAMMAR, not an expression.
- A standalone vocab item from a vocabulary table is a WORD even if it's a compound (thịt heo).
- If something appears both as vocab AND as part of a phrase, register both — they have different learning purposes.

KIND OVERRIDE: if the user supplied a kind directive in the user message, obey it.

DEDUPLICATION (重要):
- EXISTING_ITEMS hints (already in DB) may be provided. A candidate is a DUPLICATE if it teaches essentially the SAME grammar pattern / SAME fixed phrase / SAME word as an existing item — even when the wording is not identical. Treat all of these as the SAME and DROP the candidate:
  - placeholder の書き方違い: "Subject + tên là + [Name]" ≒ "[Subject] + tên là + [Name]" ≒ "Anh/Em + tên là + [Name]"（同じ「名前を名乗る」文型）
  - 疑問/平叙の言い回し違いでも、核となる文型・語が同じなら重複
  - words: 同じ語（声調・綴り同一）は重複。表記ゆれも同一とみなす
- 同一バッチ内でも、ほぼ同じ項目が複数生成されそうなら1つに統合する。
- 「完全一致」ではなく「実質的に同じ学習項目か」で判断すること。少しでも同じならドロップ。

KNOWN_VOCAB hints (already learned + this lesson's vocab) may be provided. When writing example dialogues, use ONLY words from KNOWN_VOCAB plus the target item itself. Do not introduce unfamiliar words just to round out the dialogue. If you cannot make a natural dialogue under that constraint, write a shorter one (2 turns is fine).

Return a JSON object with exactly this structure:
{
  "source_title": "TRIAL LESSON - HOMEWORK" (or null),
  "grammar": [
    {
      "category": "category in Japanese (例: 文型, 代名詞, 否定, 疑問, 助詞, 時制, 助動詞, 数詞 etc.)",
      "name": "grammar pattern (Vietnamese)",
      "summary": "1-line Japanese explanation",
      "detail": "Japanese explanation with 1-2 examples (or null)",
      "examples": ["A: ...", "B: ...", "A: ..."],
      "usage_scene": "when to use it (Japanese)",
      "frequency": 3,
      "word_notes": [
        { "word": "là", "note": "～です（コピュラ）" },
        { "word": "không", "note": "否定／文末で疑問" }
      ]
    }
  ],
  "expressions": [
    {
      "category": "category in Japanese (例: 挨拶, 自己紹介, 食事, 買い物, 仕事, 雑談 etc.)",
      "expression": "the expression in Vietnamese",
      "meaning": "Japanese meaning",
      "conversation": ["A: ...", "B: ...", "A: ..."],
      "usage_scene": "when to use (Japanese)",
      "frequency": 3,
      "word_notes": [
        { "word": "cảm ơn", "note": "ありがとう（基本形）" },
        { "word": "bạn", "note": "あなた／友達（同年代）" }
      ],
      "nuance": "丁寧で柔らかい印象。年上には 'cảm ơn anh/chị' を使うとより自然。"
    }
  ],
  "words": [
    {
      "category": "形容詞",
      "word": "tươi",
      "meaning": "新鮮な",
      "example": "A: Cá này tươi không chị?\nB: Tươi lắm em.\nA: Cho em một ký.",
      "usage_scene": "市場で魚や野菜の鮮度を尋ねるとき",
      "frequency": 4,
      "word_notes": [
        { "word": "tươi", "note": "新鮮な" },
        { "word": "cá", "note": "魚" },
        { "word": "này", "note": "この・これ" },
        { "word": "không", "note": "～ですか？（疑問）" },
        { "word": "chị", "note": "年上の女性への呼称" },
        { "word": "lắm", "note": "とても（強調）" },
        { "word": "em", "note": "年下の自称" },
        { "word": "cho", "note": "～をください" },
        { "word": "một", "note": "1（数詞）" },
        { "word": "ký", "note": "キログラム" }
      ]
    }
  ]
}

word_notes rules (重要・必読):
- ★最重要★ 例文・対話のすべての行 (A → B → A の3ターン全部) に登場する全単語を網羅すること。
  ユーザーは練習中に対話の全文を読み上げるので、どこか1単語でも意味不明だと文全体が理解できない。
  1行目しかカバーされていない word_notes は不合格。必ず 2行目以降の語も拾うこと。
- Include words from BOTH sources, deduplicated:
  (a) the grammar "name" / expression "expression" / word "word" itself, AND
  (b) ALL lines of the example dialogue / example sentence you generate.
- Do NOT include words that only appear in usage_scene, detail, nuance, or category.
- Multi-word fixed units (e.g. "cảm ơn", "phải không", "không phải là") stay as one entry.
- Each word appears at most ONCE. If a word shows up in multiple places, list it only once (under its first occurrence).
- 数詞・量詞（hai mươi / ba / một ký / ngàn 等）も忘れず含める。「数字だから」と省略しない。
- 程度副詞・感嘆助詞（quá / lắm / rồi / nhé / ạ 等）も含める。
- "note" is a SHORT Japanese gloss (1 phrase, ~20 chars).
- Order: pattern words first (left to right), then NEW words from the dialogue in line order (A → B → A).
- Target count: ターゲット語 + 対話の登場語ぶんを過不足なく。grammar/expression なら通常 6〜15 entries 程度になる。少なすぎる場合は再点検すること。
- Skip ONLY: pure structural placeholders ("S", "V", "O", "名詞", "動詞", "形容詞"), obvious English/Japanese cognates that the learner cannot misunderstand, and proper names of people. それ以外は基本拾う。

nuance rules (expressions only):
- 1-2 sentences in Japanese describing how this phrase comes across to the listener (politeness level, age/relationship register, warmth, formality, common alternatives).
- Always include for expressions. Omit (null) only if there is genuinely no register concern.

Conversation / example rules (重要・新):
- Lines MUST use ONLY words from KNOWN_VOCAB plus the target item being taught. Do NOT introduce new vocabulary in the dialogue.
- Keep dialogues SHORT: 2 turns is preferred, 3 turns max (A/B or A/B/A). Each line ≤ 8 words.
- Target the SINGLE learning item — repeat it once in the dialogue, do not pile on multiple new things.
- For "words" entries, "example" is also an A/B/A 3-turn dialogue (same shape as grammar/expressions). The target word must appear in the dialogue. Still bounded by KNOWN_VOCAB.
- 極端なスラングは避けるが、語彙は南部 (Saigon) 方言を既定とする（上の DIALECT ルール参照）。

★REGISTER (最重要) — 友人同士のフランクな日常会話にする★
- 会話の話者 A・B は基本的に「友人・同年代の知り合い」という前提。ホーチミンの日常（カフェ、市場、屋台、同僚、ご近所、バイク）で実際に交わされる、生きたカジュアルな会話にする。教科書的・直訳的・フォーマルな言い回しは禁止。
- ★一人称 "tôi" は絶対に使わない★ — "tôi" は事務的・フォーマルすぎて友人同士の会話では不自然。例文・対話・word_notes のどこにも tôi を出さないこと。
  - 友人・同年代どうし: 自分も相手も "mình"（または名前）を使う。
  - 相手が年上: 自分=em、相手=anh（男）/ chị（女）。
  - 相手が年下: 自分=anh/chị、相手=em。
- "bạn" も呼びかけとしては教科書的。anh/chị/em や名前、mình を優先する。
- 文末詞（nha / nghen / hen / á / ạ など南部のもの）を自然に付けて、生っぽさを出す。
- 直訳的な堅い表現より、ベトナム人が実際に口にするくだけた言い回しを選ぶ。

General rules:
- A1 ONLY. If an input item is above A1, still classify it but mark frequency=1; do not silently drop user-requested items unless they duplicate EXISTING_ITEMS.
- All dialogue lines start with "A: " or "B: ".
- Personalize lightly to Takaki's life (coworkers, bạn (friend), cafe, motorbike, District 1-3) but stay simple and stay within KNOWN_VOCAB.
- frequency = 5 for must-know greetings, 3 for common, 1 for rare.
- detail can be null if summary is sufficient.

TOPIC (each item — required):
- For every grammar / expression / word item, also set "topic": the subject of the example conversation/dialogue you wrote for it.
- topic.label: a short English label, 1-2 words (例: "Cooking", "Market", "Coffee", "Family", "Shopping", "Directions", "Greetings"). English only — even though the dialogue itself is Vietnamese.
- topic.icon: pick the single best-matching icon name from this fixed list — [chef-hat, briefcase, plane, heart, book-open, coffee, shopping-bag, home, dumbbell, code, cat, dog, bike, utensils, music, users, map-pin, wallet, shirt, brain, sparkles, message-circle]. Use "message-circle" only when nothing else fits.

PATTERN HIGHLIGHT (grammar & expression items — required):
- pattern_quote: copy verbatim the exact run of words FROM one dialogue line where the pattern/expression actually occurs (grammar → examples, expression → conversation). It MUST be an exact substring of a line so the UI can highlight it. The expression may be inflected or slightly varied in the dialogue — quote it exactly as it appears there.
- Return ONLY valid JSON, no markdown, no explanation.`;

const CORE_VI_VOCAB = [
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { text, language, kind } = (await request.json()) as {
    text?: string;
    language?: "en" | "vi";
    kind?: "grammar" | "phrase" | "word";
  };
  if (!text?.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const lang: "en" | "vi" = language === "vi" ? "vi" : "en";

  let userMessage: string;
  if (lang === "vi") {
    // VI: pull existing items so the model can dedupe near-duplicates,
    // and pass known vocabulary so generated dialogues stay simple.
    const [
      { data: gExisting },
      { data: eExisting },
      { data: wExisting },
    ] = await Promise.all([
      supabase
        .from("grammar")
        .select("name")
        .eq("language", "vi")
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("expressions")
        .select("expression")
        .eq("language", "vi")
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("words")
        .select("word")
        .eq("language", "vi")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    const existingHint = JSON.stringify({
      grammar: (gExisting ?? []).map((r) => r.name),
      expressions: (eExisting ?? []).map((r) => r.expression),
      words: (wExisting ?? []).map((r) => r.word),
    });

    const knownVocab = Array.from(
      new Set([
        ...CORE_VI_VOCAB,
        ...((wExisting ?? []) as { word: string }[]).map((w) =>
          w.word.toLowerCase(),
        ),
      ]),
    );

    let kindDirective =
      "Classify each item into grammar / expressions / words.";
    if (kind === "grammar") {
      kindDirective =
        'The user has indicated that EVERY item below is a GRAMMAR pattern. Put them all under "grammar" and leave "expressions" and "words" as empty arrays. Do not reclassify.';
    } else if (kind === "phrase") {
      kindDirective =
        'The user has indicated that EVERY item below is a fixed PHRASE / EXPRESSION. Put them all under "expressions" and leave "grammar" and "words" as empty arrays. Do not reclassify.';
    } else if (kind === "word") {
      kindDirective =
        'The user has indicated that EVERY item below is a single WORD / vocab entry. Put them all under "words" and leave "grammar" and "expressions" as empty arrays. Do not reclassify.';
    }

    userMessage = `EXISTING_ITEMS (drop near-duplicates):
${existingHint}

KNOWN_VOCAB (use ONLY these words in dialogues / examples; the target item itself is also allowed):
${JSON.stringify(knownVocab)}

The user pasted lesson material below. Extract source_title if present at the top, then classify items. ${kindDirective} Produce word_notes per the system rules. For expressions also produce nuance.

INPUT:
${text}`;
  } else {
    const angles = pickAnglesEN(3);
    const angleBlock = angles.map((a) => `- ${a}`).join("\n");
    userMessage = `PRIORITY_ANGLES (use these as the dominant context for the conversation examples in THIS run; assign a different angle to each item — do not reuse the same angle across items):\n${angleBlock}\n\nExtract grammar points and expressions from this Native Camp lesson material:\n\n${text}`;
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    // VI は word_notes 配列＋nuance ＋ words 配列で出力が膨らむため EN の2倍以上に確保
    max_tokens: lang === "vi" ? 12000 : 4096,
    system: lang === "vi" ? SYSTEM_PROMPT_VI : SYSTEM_PROMPT_EN,
    tools: [
      {
        name: "save_extracted",
        description:
          "Save the extracted grammar items, expression items, and word items to the user's library.",
        input_schema: EXTRACT_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "save_extracted" },
    messages: [{ role: "user", content: userMessage }],
  });

  if (message.stop_reason === "max_tokens") {
    console.error("[extract] hit max_tokens, output truncated", {
      lang,
      usage: message.usage,
    });
    return NextResponse.json(
      { error: "Output truncated; try fewer items at once" },
      { status: 500 },
    );
  }

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    console.error("[extract] no tool_use block in response", {
      lang,
      stopReason: message.stop_reason,
      contentTypes: message.content.map((c) => c.type),
    });
    return NextResponse.json(
      { error: "Unexpected response shape" },
      { status: 500 },
    );
  }

  return NextResponse.json(toolUse.input);
}
