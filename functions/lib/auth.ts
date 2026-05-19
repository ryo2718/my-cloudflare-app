// 認証 helper:
//  - Authorization header から Bearer session_id を抽出
//  - session_id → 対応 account を D1 から取り出す
//  - constant-time 文字列比較 (タイミング攻撃対策)
//
// 旧 site-wide HMAC cookie 認証 (createAuthCookie / verifyAuthCookie) は撤去。
// 新方式: D1 sessions テーブルを single source of truth とする。

import {
  deleteSession,
  findAccountById,
  findActiveSession,
  touchSessionAccess,
} from './db';
import { SESSION_IDLE_TIMEOUT_MS, type AccountPublic, type AccountRow } from './types';

/** Authorization: Bearer <id> から <id> を抽出。形式不正/欠落は null。 */
export function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

/**
 * D1 から session を検証し、 対応 account を返す。 失効 / 不正は null。
 *  - findActiveSession で expires_at + idle timeout チェック
 *  - 失効を確認できた場合は念のため session 行を物理削除 (幽霊セッション防止)
 *  - 有効ならば last_accessed_at を Date.now() に更新 (アイドル猶予のリセット)
 */
export async function resolveAccountFromSession(
  db: D1Database,
  sessionId: string,
): Promise<AccountRow | null> {
  const session = await findActiveSession(db, sessionId);
  if (!session) {
    // 失効分の物理削除 (id 一致行のみ、 他端末セッションには影響しない)
    await deleteSession(db, sessionId).catch(() => {});
    return null;
  }
  await touchSessionAccess(db, sessionId).catch(() => {});
  return await findAccountById(db, session.account_id);
}

/** SESSION_IDLE_TIMEOUT_MS を auth 経由で公開 (ログイン側でも利用)。 */
export const IDLE_TIMEOUT_MS = SESSION_IDLE_TIMEOUT_MS;

/** Request の Authorization header から account を直接取り出すショートカット。 */
export async function resolveAccountFromRequest(
  db: D1Database,
  request: Request,
): Promise<AccountRow | null> {
  const token = extractBearerToken(request.headers.get('Authorization'));
  if (!token) return null;
  return await resolveAccountFromSession(db, token);
}

/** AccountRow → AccountPublic (private_pass を落として is_admin / is_ranking_excluded を boolean に)。 */
export function toAccountPublic(row: AccountRow): AccountPublic {
  return {
    id: row.id,
    poker_name: row.poker_name,
    is_admin: row.is_admin === 1,
    is_ranking_excluded: row.is_ranking_excluded === 1,
  };
}

/** 一定時間で文字列比較 (タイミング攻撃対策、private_pass / group_key 検証で使用)。 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** JSON レスポンス (Cache-Control: no-store)。 */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
