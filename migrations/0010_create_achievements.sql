-- 0010_create_achievements:
--   user_achievements: ユーザー × 実績の解除履歴 (1 行 = 1 アンロック)
--   UNIQUE (account_id, achievement_id) で同一実績の重複アンロックを防止。
--   achievement_id はコード側の master (src/data/achievements.ts) と一致する文字列。

CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  UNIQUE (account_id, achievement_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_account
  ON user_achievements(account_id);
