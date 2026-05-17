-- 0004_training_results_v2: training_results を「最高得点記録」スキーマへ更新。
--
-- 0003 で作った旧スキーマ (training_type / score / completed_at) を破棄し、
-- 新スキーマ (best_score / total_attempts / updated_at + UNIQUE(account_id, training_type))
-- に置き換える。0003 で生成された training_results は空 (まだ書込み導線がない) なので
-- データロスは発生しない。

DROP TABLE IF EXISTS training_results;

CREATE TABLE training_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  training_type TEXT NOT NULL,                  -- 'preflop_beginner' / 'preflop_intermediate' 等
  best_score INTEGER NOT NULL DEFAULT 0,        -- 20 問中の最高正解数
  best_score_at INTEGER NOT NULL,               -- 最高得点を出した unix ms
  total_attempts INTEGER NOT NULL DEFAULT 0,    -- 挑戦回数
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, training_type)
);

CREATE INDEX IF NOT EXISTS idx_training_results_account
  ON training_results(account_id);
