-- missed_problems: 中級・初級トレーニングで満点未達だった問題の記録テーブル。
-- Step 1 (DB 基盤): 復習機能・統計機能の前提として、満点を取れなかった問題を永続化する。
--
-- カラム:
--   account_id          所有アカウント (accounts.id)
--   training_type       'preflop_beginner' / 'preflop_intermediate'
--   scenario_type       'bb_response' / 'vs_3bet' / 'vs_4bet' / 'middle_vs_open'
--                       / 'risky_open' / 'beginner_open' / 'beginner_vs_open'
--   hero_position       自分のポジション ('UTG' 等)
--   opener_position     該当する場合のみ (該当なしは NULL)
--   three_bettor_position vs_3bet / vs_4bet 用 (該当なしは NULL)
--   hand                'AKs' / '22' / '72o' 等
--   user_selections     JSON 文字列 (中級: ['call','fold']、初級: ['participate'] 等)
--   gto_strategy        JSON 文字列 {allin, raise, call, fold} (0-100 スケール)
--   score_obtained      獲得点 (-1 / 0 / 1)
--   is_timeout          時間切れフラグ (0/1)
--   is_removed_from_review 復習リストから外したフラグ (0/1、統計には残る)
--   created_at          Date.now() の epoch ms

CREATE TABLE IF NOT EXISTS missed_problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  training_type TEXT NOT NULL,
  scenario_type TEXT NOT NULL,
  hero_position TEXT NOT NULL,
  opener_position TEXT,
  three_bettor_position TEXT,
  hand TEXT NOT NULL,
  user_selections TEXT NOT NULL,
  gto_strategy TEXT NOT NULL,
  score_obtained INTEGER NOT NULL,
  is_timeout INTEGER NOT NULL DEFAULT 0,
  is_removed_from_review INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_missed_account_review
  ON missed_problems(account_id, is_removed_from_review, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_missed_account_scenario
  ON missed_problems(account_id, scenario_type, hero_position);
