-- 0002_seed: 初期データ
-- - テスト君 (admin)
-- - 現行 group_key "2818"

INSERT INTO accounts (poker_name, private_pass, is_admin, created_at)
VALUES ('テスト君', 'test', 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

INSERT INTO group_keys (key_value, active_from, active_until, created_at)
VALUES ('2818',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  NULL,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000);
