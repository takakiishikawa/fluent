-- 028: Output の各バージョンに音読カウントを持たせる
-- Run this in the Supabase SQL editor (schema: fluent)
--
-- responses[i] と同じインデックスで対応する read_aloud_counts[i] を持つ。
-- 書いた文章を声に出して読む練習の回数（目安10回）をカウントする。

ALTER TABLE fluent.output_topics
  ADD COLUMN IF NOT EXISTS read_aloud_counts integer[] NOT NULL DEFAULT '{}';
