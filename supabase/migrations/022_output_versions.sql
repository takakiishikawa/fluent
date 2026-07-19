-- 022: Output に複数下書き（Version）を持たせる
-- Run this in the Supabase SQL editor (schema: nativego)

ALTER TABLE nativego.output_topics
  ADD COLUMN IF NOT EXISTS responses text[] NOT NULL DEFAULT '{}';

-- 既存の response を Version 1 として移行
UPDATE nativego.output_topics
SET responses = ARRAY[response]
WHERE responses = '{}' AND response <> '';
