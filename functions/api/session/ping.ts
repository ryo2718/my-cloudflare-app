// POST /api/session/ping
//   Header: Authorization: Bearer <session_id>
//   セッションの last_accessed_at を更新するだけの最小エンドポイント。
//   トレーニングのプレイ中 (認証 API を呼ばない区間) にアイドル失効しないよう延命する。
//   認証チェックは既存の resolveAccountFromRequest を流用 (= findActiveSession +
//   touchSessionAccess)。新しい権限・データアクセスは増やさない。
//   Response 200: { ok: true } / 401: { error: 'unauthorized' }

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import type { Env } from '../../lib/types';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) {
    return jsonResponse(401, { error: 'unauthorized' });
  }
  return jsonResponse(200, { ok: true });
};
