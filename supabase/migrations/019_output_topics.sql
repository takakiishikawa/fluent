-- 019: Output（トピック別ライティング練習）テーブル
-- Run this in the Supabase SQL editor (schema: nativego)
--
-- 週1レッスン前に話す内容を準備する画面。ユーザーがトピックを作成し、
-- 自分の言葉で英語（または他言語）の回答を書いて保存する。AI採点なし。

CREATE TABLE IF NOT EXISTS nativego.output_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en',
  title text NOT NULL,
  response text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nativego.output_topics ENABLE ROW LEVEL SECURITY;

-- RLS: 本人レコードのみアクセス可
CREATE POLICY "Users can read own output_topics"
  ON nativego.output_topics FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own output_topics"
  ON nativego.output_topics FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own output_topics"
  ON nativego.output_topics FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own output_topics"
  ON nativego.output_topics FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_output_topics_user_lang
  ON nativego.output_topics(user_id, language, created_at DESC);

-- nativego スキーマには ALTER DEFAULT PRIVILEGES が無いため、新規テーブルには
-- 明示的に GRANT を当てる必要がある
GRANT SELECT, INSERT, UPDATE, DELETE ON nativego.output_topics TO authenticated;
