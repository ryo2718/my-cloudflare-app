// PATCH /api/account/missed-problems/:id/remove
// 自分の missed_problem の is_removed_from_review フラグを 1 に更新。
// DELETE ではなくフラグ更新 (統計用に記録は残す)。

import { jsonResponse, resolveAccountFromRequest } from '../../../../lib/auth';
import type { Env, MissedProblemRow } from '../../../../lib/types';

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) return jsonResponse(401, { error: 'unauthorized' });

  const idRaw = params.id;
  const id = typeof idRaw === 'string' ? parseInt(idRaw, 10) : NaN;
  if (!Number.isFinite(id)) return jsonResponse(400, { error: 'invalid_id' });

  // 所有確認
  const existing = await env.DB
    .prepare(`SELECT id FROM missed_problems WHERE id = ? AND account_id = ?`)
    .bind(id, account.id)
    .first<Pick<MissedProblemRow, 'id'>>();
  if (!existing) return jsonResponse(404, { error: 'not_found' });

  await env.DB
    .prepare(`UPDATE missed_problems SET is_removed_from_review = 1 WHERE id = ?`)
    .bind(id)
    .run();

  return jsonResponse(200, { success: true });
};
