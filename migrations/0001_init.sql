-- 0001_init: 認証システムのコアテーブル群
-- 仕様: design_phase_ab.md §B-1

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poker_name TEXT UNIQUE NOT NULL,
  private_pass TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX idx_accounts_poker_name ON accounts(poker_name);

CREATE TABLE group_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_value TEXT NOT NULL,
  active_from INTEGER NOT NULL,
  active_until INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_group_keys_active ON group_keys(active_until);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_account ON sessions(account_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE quiz_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX idx_quiz_results_account ON quiz_results(account_id);
