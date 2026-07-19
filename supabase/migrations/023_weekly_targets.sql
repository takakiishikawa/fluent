-- 023: Output / Input の週間目標 + Input の週次アクティビティ追跡
-- Run this in the Supabase SQL editor (schema: nativego)

ALTER TABLE nativego.user_settings
  ADD COLUMN IF NOT EXISTS baseline_output integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS baseline_input integer NOT NULL DEFAULT 1;

-- Round のチェックを週内に行ったかどうかを判定するためのタイムスタンプ
ALTER TABLE nativego.grammar
  ADD COLUMN IF NOT EXISTS rounds_updated_at timestamptz;

ALTER TABLE nativego.expressions
  ADD COLUMN IF NOT EXISTS rounds_updated_at timestamptz;
