-- 0009_add_season_points:
--   training_results に season_score / season_id を追加
--   season_id 形式: 'YYYY-MM' (開始月 5/7/9/11/1/3)
--   season_score: 当該シーズン内の best_score (シーズン跨ぎでリセット)
--
-- 既存行のデフォルトは '2026-05' (シーズン1 = 5-6月、運用開始期)。
-- 既存スコアは「シーズン1で取得した」扱いとし、 season_score は初期値 0 (= 当該
-- シーズンの記録は未取得、 best_score だけが残っている)。 これにより既存ユーザーは
-- 次回プレイで season_score が正しく更新される。

ALTER TABLE training_results ADD COLUMN season_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE training_results ADD COLUMN season_id TEXT NOT NULL DEFAULT '2026-05';
