-- problem_attempts: 全問題の挑戦履歴 (正解・不正解問わず)。
-- Step 3b (統計画面): ポジ別 / シナリオ別の正答率集計に使用。
--
-- missed_problems との違い:
--   - missed_problems: 満点未達のみ、復習リストの基盤
--   - problem_attempts: 全問記録、統計集計の基盤
--
-- 採点直後 (本通常プレイ完了時) に INSERT。復習プレイは INSERT しない。

CREATE TABLE IF NOT EXISTS problem_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  training_type TEXT NOT NULL,
  scenario_type TEXT NOT NULL,
  hero_position TEXT NOT NULL,
  opener_position TEXT,
  three_bettor_position TEXT,
  hand TEXT NOT NULL,
  score_obtained INTEGER NOT NULL,
  is_timeout INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_account_position
  ON problem_attempts(account_id, hero_position);

CREATE INDEX IF NOT EXISTS idx_attempts_account_scenario
  ON problem_attempts(account_id, scenario_type);

CREATE INDEX IF NOT EXISTS idx_attempts_account_type
  ON problem_attempts(account_id, training_type);
