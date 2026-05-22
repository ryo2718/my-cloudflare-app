// /api/session/* client。トレーニングのプレイ中にサーバセッションを延命する ping。

import { AuthApiError } from './auth';

/**
 * セッション延命 ping。成功でサーバの last_accessed_at が更新される。
 * 失敗 (401 等) は AuthApiError を throw (呼び出し側で握りつぶしてよい)。
 */
export async function apiSessionPing(sessionId: string): Promise<void> {
  const res = await fetch('/api/session/ping', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  if (res.ok) return;
  throw new AuthApiError(`http_${res.status}`, res.status);
}
