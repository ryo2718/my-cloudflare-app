// D1 helper: typed queries for accounts / sessions / group_keys.
//
// D1 の prepare/bind を直接使うとボイラープレートが増えるので、頻出パターンだけまとめる。

import {
  SESSION_IDLE_TIMEOUT_MS,
  type AccountRow,
  type GroupKeyRow,
  type SessionRow,
} from './types';

// ---------------------------------------------------------------------------
// accounts
// ---------------------------------------------------------------------------

export async function findAccountByName(db: D1Database, pokerName: string): Promise<AccountRow | null> {
  return await db
    .prepare('SELECT * FROM accounts WHERE poker_name = ?')
    .bind(pokerName)
    .first<AccountRow>();
}

export async function findAccountById(db: D1Database, id: number): Promise<AccountRow | null> {
  return await db.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first<AccountRow>();
}

export async function listAccounts(db: D1Database): Promise<AccountRow[]> {
  const res = await db.prepare('SELECT * FROM accounts ORDER BY id ASC').all<AccountRow>();
  return res.results ?? [];
}

export async function insertAccount(
  db: D1Database,
  args: { pokerName: string; privatePass: string; isAdmin: boolean },
): Promise<number> {
  const now = Date.now();
  const res = await db
    .prepare(
      'INSERT INTO accounts (poker_name, private_pass, is_admin, created_at) VALUES (?, ?, ?, ?)',
    )
    .bind(args.pokerName, args.privatePass, args.isAdmin ? 1 : 0, now)
    .run();
  // D1 returns meta.last_row_id for AUTOINCREMENT
  const id = (res.meta as { last_row_id?: number } | undefined)?.last_row_id;
  if (typeof id !== 'number') {
    throw new Error('insertAccount: failed to obtain new id');
  }
  return id;
}

export async function touchLastLogin(db: D1Database, accountId: number): Promise<void> {
  await db
    .prepare('UPDATE accounts SET last_login_at = ? WHERE id = ?')
    .bind(Date.now(), accountId)
    .run();
}

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

export async function createSession(
  db: D1Database,
  args: { accountId: number; durationMs: number },
): Promise<{ id: string; expiresAt: number }> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + args.durationMs;
  await db
    .prepare(
      'INSERT INTO sessions (id, account_id, created_at, expires_at, last_accessed_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, args.accountId, now, expiresAt, now)
    .run();
  return { id, expiresAt };
}

/**
 * セッションを取得。 expires_at 期限切れ または last_accessed_at から
 * SESSION_IDLE_TIMEOUT_MS 経過のいずれかで null を返す (= 失効)。
 * 呼び出し側は失効時に DELETE してから 401 を返す想定。
 */
export async function findActiveSession(
  db: D1Database,
  sessionId: string,
): Promise<SessionRow | null> {
  const now = Date.now();
  return await db
    .prepare(
      `SELECT * FROM sessions
       WHERE id = ?
         AND expires_at > ?
         AND last_accessed_at > ?`,
    )
    .bind(sessionId, now, now - SESSION_IDLE_TIMEOUT_MS)
    .first<SessionRow>();
}

/** 認証成功時に last_accessed_at を現在時刻に更新する (アイドルタイマーのリセット)。 */
export async function touchSessionAccess(
  db: D1Database,
  sessionId: string,
): Promise<void> {
  await db
    .prepare('UPDATE sessions SET last_accessed_at = ? WHERE id = ?')
    .bind(Date.now(), sessionId)
    .run();
}

/** 指定 account の失効済みセッション (idle timeout 超過) を物理削除。 */
export async function deleteIdleSessions(
  db: D1Database,
  accountId: number,
): Promise<void> {
  const cutoff = Date.now() - SESSION_IDLE_TIMEOUT_MS;
  await db
    .prepare(
      'DELETE FROM sessions WHERE account_id = ? AND last_accessed_at <= ?',
    )
    .bind(accountId, cutoff)
    .run();
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

/**
 * 指定 account に有効 (期限内 + アイドル未失効) なセッションが存在するか。
 * 先着優先の単一端末制限で「既ログイン中」判定に使う。
 * idle timeout を超えたセッションは「無効」と見なす。
 */
export async function hasActiveSessionForAccount(
  db: D1Database,
  accountId: number,
): Promise<boolean> {
  const now = Date.now();
  const row = await db
    .prepare(
      `SELECT id FROM sessions
       WHERE account_id = ?
         AND expires_at > ?
         AND last_accessed_at > ?
       LIMIT 1`,
    )
    .bind(accountId, now, now - SESSION_IDLE_TIMEOUT_MS)
    .first<{ id: string }>();
  return row !== null;
}

/**
 * 指定 account の全セッションを削除。
 * 単一端末ログイン制限 (一般ユーザーのみ、admin / is_ranking_excluded は例外) で使用。
 */
export async function deleteAccountSessions(
  db: D1Database,
  accountId: number,
): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId).run();
}

// ---------------------------------------------------------------------------
// group_keys
// ---------------------------------------------------------------------------

export async function findActiveGroupKey(db: D1Database): Promise<GroupKeyRow | null> {
  return await db
    .prepare('SELECT * FROM group_keys WHERE active_until IS NULL ORDER BY id DESC LIMIT 1')
    .first<GroupKeyRow>();
}

/**
 * 新 group_key を発行: 既存 active レコードに active_until を埋め、新レコード INSERT。
 * トランザクション保証は D1 の batch を使う。
 */
export async function rotateGroupKey(
  db: D1Database,
  newKeyValue: string,
): Promise<GroupKeyRow> {
  const now = Date.now();
  await db.batch([
    db.prepare('UPDATE group_keys SET active_until = ? WHERE active_until IS NULL').bind(now),
    db
      .prepare(
        'INSERT INTO group_keys (key_value, active_from, active_until, created_at) VALUES (?, ?, NULL, ?)',
      )
      .bind(newKeyValue, now, now),
  ]);
  const newRow = await findActiveGroupKey(db);
  if (!newRow) {
    throw new Error('rotateGroupKey: failed to insert new group_key');
  }
  return newRow;
}
