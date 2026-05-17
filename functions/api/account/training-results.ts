// GET /api/account/training-results
//   Header: Authorization: Bearer <session_id>
//   Response 200: { training_results: TrainingResultRow[] }   (空配列でも OK)
//   Response 401: { error: 'unauthorized' }

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import type { Env, TrainingResultRow } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) {
    return jsonResponse(401, { error: 'unauthorized' });
  }
  const res = await env.DB
    .prepare(
      'SELECT * FROM training_results WHERE account_id = ? ORDER BY updated_at DESC',
    )
    .bind(account.id)
    .all<TrainingResultRow>();
  return jsonResponse(200, { training_results: res.results ?? [] });
};
