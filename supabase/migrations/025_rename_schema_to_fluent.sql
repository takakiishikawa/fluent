-- 025: プロダクト名変更 (NativeGo -> Fluent) に伴うスキーマリネーム
-- Run this in the Supabase SQL editor
--
-- ALTER SCHEMA ... RENAME TO は名前空間の付け替えのみ。中のテーブル・
-- 既存の GRANT・RLS ポリシーはそのまま維持される（再GRANT不要）。
--
-- 適用手順（順番が重要 — 途中でアプリが動かなくなる時間を作らないため）:
--   1. このSQLを Supabase SQL Editor で実行してスキーマ名を変更
--   2. Supabase Dashboard > Project Settings > Data API > Exposed schemas
--      で "nativego" を外し "fluent" を追加（PostgREST が新しい名前で
--      スキーマを認識するために必須。これをやらないと API が 404 になる）
--   3. 上記2つが完了した状態で、schema: "fluent" を参照するアプリの
--      デプロイを行う（lib/supabase/client.ts, server.ts, admin.ts は
--      対応済み）
--
-- 1と2は同じタイミングで行う必要がある（スキーマ名を変えた瞬間から
-- 新デプロイが反映されるまでの間は一時的にAPIエラーが出る点に注意）

ALTER SCHEMA nativego RENAME TO fluent;
