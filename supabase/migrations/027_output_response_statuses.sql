-- 027: Output の各バージョンに Draft / Revised ステータスを持たせる
-- Run this in the Supabase SQL editor (schema: fluent)
--
-- responses[i] と同じインデックスで対応する response_statuses[i] を持つ。
-- 'draft'（下書き・レビュー待ち）/ 'revised'（Claudeにレビューしてもらい改善済み）。

ALTER TABLE fluent.output_topics
  ADD COLUMN IF NOT EXISTS response_statuses text[] NOT NULL DEFAULT '{}';
