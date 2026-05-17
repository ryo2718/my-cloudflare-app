// GET /api/admin/accounts
//   Header: Authorization: Bearer <admin session>
//   Response 200: { accounts: AccountAdmin[] }
//
// Phase 9 で各 account の total_points (training_results.best_score の合計) を JOIN で算出。
// 未挑戦アカウントは total_points = 0。

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import type { AccountAdmin, Env } from '../../lib/types';

interface AccountWithTotal {
  id: number;
  poker_name: string;
  private_pass: string;
  is_admin: number;
  created_at: number;
  last_login_at: number | null;
  total_points: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await resolveAccountFromRequest(env.DB, request);
  if (!me || me.is_admin !== 1) {
    return jsonResponse(403, { error: 'forbidden' });
  }

  const res = await env.DB
    .prepare(
      `SELECT
         a.id, a.poker_name, a.private_pass, a.is_admin,
         a.created_at, a.last_login_at,
         COALESCE(SUM(t.best_score), 0) AS total_points
       FROM accounts a
       LEFT JOIN training_results t ON t.account_id = a.id
       GROUP BY a.id
       ORDER BY a.id ASC`,
    )
    .all<AccountWithTotal>();
  const rows = res.results ?? [];

  const accounts: AccountAdmin[] = rows.map((r) => ({
    id: r.id,
    poker_name: r.poker_name,
    private_pass: r.private_pass,
    is_admin: r.is_admin === 1,
    created_at: r.created_at,
    last_login_at: r.last_login_at,
    total_points: r.total_points,
  }));
  return jsonResponse(200, { accounts });
};
