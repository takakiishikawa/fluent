-- 021: Input（Grammar/Phrase）ラウンド制への移行
-- Run this in the Supabase SQL editor (schema: nativego)
--
-- 020で追加した understood フラグを、Round 1/2/3 の3段階チェックに置き換える。
-- Round N はその項目の Round 1..N-1 が全て完了していないとロックされる（UI側で制御）。

ALTER TABLE nativego.grammar
  ADD COLUMN IF NOT EXISTS round1_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round2_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round3_done boolean NOT NULL DEFAULT false;

ALTER TABLE nativego.expressions
  ADD COLUMN IF NOT EXISTS round1_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round2_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round3_done boolean NOT NULL DEFAULT false;
