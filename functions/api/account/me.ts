// GET /api/account/me
//   Header: Authorization: Bearer <session_id>
//   Response 200: { poker_name, points, training_results: [] }
//   Response 401: { error: 'unauthorized' }
//
// /api/auth/me は最小情報 (auth state 用)、本 endpoint は extended profile (アカウント情報ページ用)。

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import { currentSeason } from '../../lib/season';
import type { AccountDetail, Env, TrainingResultRow } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) {
    return jsonResponse(401, { error: 'unauthorized' });
  }

  const trainingRes = await env.DB
    .prepare(
      'SELECT * FROM training_results WHERE account_id = ? ORDER BY updated_at DESC LIMIT 100',
    )
    .bind(account.id)
    .all<TrainingResultRow>();

  const body: AccountDetail = {
    poker_name: account.poker_name,
    points: account.points ?? 0,
    training_results: trainingRes.results ?? [],
    season: currentSeason(),
  };
  return jsonResponse(200, body);
};
