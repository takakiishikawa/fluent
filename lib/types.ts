export type Language = "en" | "vi";

export const DEFAULT_LANGUAGE: Language = "en";

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "英語",
  vi: "ベトナム語",
};

export interface WordNote {
  word: string;
  note: string;
}

/** Conversation topic shown as a chip on the repeating screen. */
export interface ItemTopic {
  /** Short English label (例: "Cooking"). */
  label: string;
  /** lucide-react icon name from the fixed TOPIC_ICONS set. */
  icon: string;
}

export interface Grammar {
  id: string;
  name: string;
  summary: string;
  detail: string | null;
  examples: string;
  usage_scene: string;
  play_count: number;
  last_played_at: string | null;
  created_at: string;
  lesson_id: string | null;
  language: Language;
  word_notes: WordNote[] | null;
  category: string | null;
  note: string | null;
  source_title: string | null;
  topic_label: string | null;
  topic_icon: string | null;
  pattern_quote: string | null;
}

export interface Expression {
  id: string;
  // DB は NOT NULL だが、UI 上は未設定（場面なし）を null として扱う
  category: string | null;
  expression: string;
  meaning: string;
  conversation: string;
  usage_scene: string;
  play_count: number;
  last_played_at: string | null;
  created_at: string;
  lesson_id: string | null;
  language: Language;
  word_notes: WordNote[] | null;
  nuance: string | null;
  note: string | null;
  source_title: string | null;
  topic_label: string | null;
  topic_icon: string | null;
  pattern_quote: string | null;
}

export interface Word {
  id: string;
  word: string;
  meaning: string;
  example: string | null;
  usage_scene: string | null;
  word_notes: WordNote[] | null;
  play_count: number;
  last_played_at: string | null;
  created_at: string;
  lesson_id: string | null;
  language: Language;
  note: string | null;
  source_title: string | null;
  category: string | null;
  topic_label: string | null;
  topic_icon: string | null;
}

export interface Lesson {
  id: string;
  level: number;
  lesson_no: string;
  topic: string;
  status: "未登録" | "練習中" | "習得済み";
  language: Language;
}

export interface PracticeLog {
  id: string;
  practiced_at: string;
  created_at: string;
  grammar_done_count: number;
  expression_done_count: number;
  word_done_count: number;
  speaking_count: number;
}

export interface OutputTopic {
  id: string;
  user_id: string;
  language: Language;
  title: string;
  response: string;
  created_at: string;
  updated_at: string;
}

export interface NativeCampLog {
  id: string;
  user_id: string;
  logged_at: string;
  count: number;
  minutes: number;
  created_at: string;
}

export interface YoutubeChannel {
  id: string;
  user_id: string;
  channel_name: string;
  channel_url: string;
  archived: boolean;
  created_at: string;
}

export interface YoutubeVideo {
  id: string;
  channel_id: string;
  title: string;
  video_url: string;
  duration: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  sort_order: number;
}

export interface YoutubeLog {
  id: string;
  user_id: string;
  video_id: string;
  lap: number;
  completed_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  baseline_repeating: number;
  baseline_speaking: number;
  baseline_nativecamp: number;
  baseline_shadowing: number;
  speaking_test_day: number;
  current_language: Language;
  created_at: string;
  updated_at: string;
}

export interface ExtractedGrammar {
  name: string;
  summary: string;
  detail?: string;
  examples: string[];
  usage_scene: string;
  frequency: number;
  word_notes?: WordNote[];
  category?: string;
  topic?: ItemTopic;
  pattern_quote?: string;
}

export interface ExtractedExpression {
  category: string;
  expression: string;
  meaning: string;
  conversation: string[];
  usage_scene: string;
  frequency: number;
  word_notes?: WordNote[];
  nuance?: string;
  topic?: ItemTopic;
  pattern_quote?: string;
}

export interface ExtractedWord {
  word: string;
  meaning: string;
  example?: string | null;
  usage_scene?: string | null;
  word_notes?: WordNote[];
  frequency: number;
  category?: string | null;
  topic?: ItemTopic;
}

export interface ExtractResult {
  grammar: ExtractedGrammar[];
  expressions: ExtractedExpression[];
  words?: ExtractedWord[];
  source_title?: string | null;
}
