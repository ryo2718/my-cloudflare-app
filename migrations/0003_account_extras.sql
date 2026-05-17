-- 0003_account_extras: アカウント情報ページ用の拡張
--  - accounts.points (将来のポイント機能用、デフォルト 0)
--  - training_results テーブル (トレーニング成績用、quiz_results とは別)

ALTER TABLE accounts ADD COLUMN points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS training_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  training_type TEXT NOT NULL,                  -- 例: 'preflop', 'postflop_cb' (将来定義)
  score INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_training_results_account
  ON training_results(account_id, completed_at DESC);
