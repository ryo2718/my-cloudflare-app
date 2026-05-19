-- 0011_add_session_last_accessed:
--   sessions.last_accessed_at を追加 (ms epoch、 整数)。
--   各 API 認証チェックで現在時刻に更新、 5 分以上経過なら失効扱いで削除。
--
--   既存スキーマ:
--     sessions(id TEXT PK, account_id INTEGER, created_at INTEGER, expires_at INTEGER)
--   既存セッションの last_accessed_at 初期値は強制的に削除対象になるよう 0 を入れず、
--   created_at を移植して「直前まで生きていた」状態にする (= migration 直後の運用断絶を緩和)。

ALTER TABLE sessions ADD COLUMN last_accessed_at INTEGER NOT NULL DEFAULT 0;

UPDATE sessions SET last_accessed_at = created_at;
