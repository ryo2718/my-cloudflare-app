-- 0008_add_ranking_excluded_flag:
--  - accounts.is_ranking_excluded カラム追加 (デフォルト 0)
--  - ryoji にランキング除外フラグを設定 (admin ではないが管理者の個人アカウント)
--
-- 通常ユーザー   : is_admin=0 AND is_ranking_excluded=0 → 通常ランキングに表示
-- ranking_excluded: is_admin=0 AND is_ranking_excluded=1 → 「参考」枠に表示
-- admin           : is_admin=1                          → ランキング非表示
--
-- 成績リセット権限:
--  is_admin=1 OR is_ranking_excluded=1 のユーザーのみ training_results 削除可能。

ALTER TABLE accounts ADD COLUMN is_ranking_excluded INTEGER NOT NULL DEFAULT 0;

UPDATE accounts SET is_ranking_excluded = 1 WHERE poker_name = 'ryoji';
