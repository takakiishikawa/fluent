-- 020: 「理解した」フラグ（Understood）
-- Run this in the Supabase SQL editor (schema: nativego)
--
-- 反復回数（play_count）とは独立した「なぜそうなるか理解しているか」のフラグ。
-- Grammar/Phrase カタログで両方揃って初めて完全習得とする。

ALTER TABLE nativego.grammar
  ADD COLUMN IF NOT EXISTS understood boolean NOT NULL DEFAULT false;

ALTER TABLE nativego.expressions
  ADD COLUMN IF NOT EXISTS understood boolean NOT NULL DEFAULT false;
