-- 024: output_topics への GRANT 忘れを修正
-- Run this in the Supabase SQL editor (schema: nativego)
--
-- nativego スキーマには ALTER DEFAULT PRIVILEGES が無いため、新規テーブルには
-- 明示的に GRANT を当てる必要がある（019で作成時に漏れていた）

GRANT SELECT, INSERT, UPDATE, DELETE ON nativego.output_topics TO authenticated;
