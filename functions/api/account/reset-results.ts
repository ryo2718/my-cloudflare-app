// DELETE /api/account/reset-results
//   Header: Authorization: Bearer <session_id>
//   Response 200: { deleted: number }
//   Response 401: { error: 'unauthorized' }
//   Response 403: { error: 'forbidden' } (一般ユーザー)
//
// 動作:
//   - is_admin = 1 または is_ranking_excluded = 1 のユーザーのみ実行可
//   - 自分の training_results のみ削除 (problem_attempts / missed_problems は残す)

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import type { Env } from '../../lib/types';

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const me = await resolveAccountFromRequest(env.DB, request);
  if (!me) return jsonResponse(401, { error: 'unauthorized' });
  if (me.is_admin !== 1 && me.is_ranking_excluded !== 1) {
    return jsonResponse(403, { error: 'forbidden' });
  }

  const res = await env.DB
    .prepare(`DELETE FROM training_results WHERE account_id = ?`)
    .bind(me.id)
    .run();

  const deleted = (res.meta as { changes?: number } | undefined)?.changes ?? 0;
  return jsonResponse(200, { deleted });
};
