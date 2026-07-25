-- 030: Input（Grammar）のラウンドごとの自作例文を独立管理する
-- Run this in the Supabase SQL editor (schema: fluent)
--
-- これまでは単一の note 列を「自分で書く例文」欄として使い回しており、
-- Round 2/3 に進んでも Round 1 で書いた例文がそのまま引き継がれてしまっていた。
-- ラウンドごとに独立した列を持たせ、各ラウンドは空の状態から始まるようにする。

ALTER TABLE fluent.grammar
  ADD COLUMN IF NOT EXISTS round1_example text,
  ADD COLUMN IF NOT EXISTS round2_example text,
  ADD COLUMN IF NOT EXISTS round3_example text;
