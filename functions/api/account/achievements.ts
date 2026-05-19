// GET /api/account/achievements
//   Header: Authorization: Bearer <session_id>
//   Response 200: { unlocked: string[], newly_unlocked: string[] }
//   Response 401: { error: 'unauthorized' }
//
// 動作:
//   - 既存アンロックを取得
//   - evaluateAchievements で未解除分を判定 → 新規分を INSERT
//   - unlocked = 既存 + 新規、 newly_unlocked = 新規のみ

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import { evaluateAchievements } from '../../lib/achievements';
import type { Env } from '../../lib/types';

interface UnlockedRow {
  achievement_id: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) return jsonResponse(401, { error: 'unauthorized' });

  const newlyUnlocked = await evaluateAchievements(env.DB, account.id);

  const res = await env.DB
    .prepare('SELECT achievement_id FROM user_achievements WHERE account_id = ?')
    .bind(account.id)
    .all<UnlockedRow>();
  const unlocked = (res.results ?? []).map((r) => r.achievement_id);

  return jsonResponse(200, {
    unlocked,
    newly_unlocked: newlyUnlocked,
  });
};
