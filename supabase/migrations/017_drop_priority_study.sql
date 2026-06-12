-- 017: 強化フラグ（is_priority）と「学習したい」リスト（study_*）を廃止
-- Run this in the Supabase SQL editor (schema: nativego)
--
-- 撤去対象:
--   is_priority  : 強化フラグ（007 で追加）+ 関連インデックス
--   study_flag   : 学習したいリスト（014 で追加）
--   study_done   : 同 完了チェック
--   study_note   : 同 メモ
-- ※ source_title は引き続き利用するため残す

-- 1) 強化フラグ用インデックスを先に削除
DROP INDEX IF EXISTS nativego.idx_words_priority;
DROP INDEX IF EXISTS nativego.idx_expressions_priority;
DROP INDEX IF EXISTS nativego.idx_grammar_priority;

-- 2) is_priority 列を削除
ALTER TABLE nativego.grammar      DROP COLUMN IF EXISTS is_priority;
ALTER TABLE nativego.expressions  DROP COLUMN IF EXISTS is_priority;
ALTER TABLE nativego.words        DROP COLUMN IF EXISTS is_priority;

-- 3) 学習したいリスト用の列を削除
ALTER TABLE nativego.grammar
  DROP COLUMN IF EXISTS study_flag,
  DROP COLUMN IF EXISTS study_done,
  DROP COLUMN IF EXISTS study_note;

ALTER TABLE nativego.expressions
  DROP COLUMN IF EXISTS study_flag,
  DROP COLUMN IF EXISTS study_done,
  DROP COLUMN IF EXISTS study_note;

ALTER TABLE nativego.words
  DROP COLUMN IF EXISTS study_flag,
  DROP COLUMN IF EXISTS study_done,
  DROP COLUMN IF EXISTS study_note;
