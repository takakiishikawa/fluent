-- 031: Songs の週間目標を追加
-- Run this in the Supabase SQL editor (schema: fluent)
--
-- 「This week's plan」に Songs（曲の和訳を全行完了させた本数）を追加するための
-- 週間目標列。既存の baseline_output / baseline_input と同じパターン。

ALTER TABLE fluent.user_settings
  ADD COLUMN IF NOT EXISTS baseline_songs integer NOT NULL DEFAULT 2;
