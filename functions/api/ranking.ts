// GET /api/ranking
//   Header: Authorization: Bearer <session_id>
//   Response 200: { ranking: [{rank, poker_name}, ...], my_rank: number | null }
//   Response 401: { error: 'unauthorized' }
//
// 採点累計 (= 各 training_type の best_score 合計) で降順ソート。
// pt 数値はレスポンスに含めない (順位と名前のみ)。同点は accounts.id 昇順でタイブレイク。
// 未挑戦者 (training_results が無いユーザー) も 0pt として一覧に含まれる。

import { jsonResponse, resolveAccountFromRequest } from '../lib/auth';
import type { Env } from '../lib/types';

interface RankingRow {
  account_id: number;
  poker_name: string;
  total_points: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await resolveAccountFromRequest(env.DB, request);
  if (!me) return jsonResponse(401, { error: 'unauthorized' });

  // 各 account について training_results.best_score の合計を集計、未挑戦者は 0pt。
  const result = await env.DB
    .prepare(
      `SELECT
         a.id AS account_id,
         a.poker_name,
         COALESCE(SUM(t.best_score), 0) AS total_points
       FROM accounts a
       LEFT JOIN training_results t ON a.id = t.account_id
       GROUP BY a.id, a.poker_name
       ORDER BY total_points DESC, a.id ASC`,
    )
    .all<RankingRow>();

  const rows = result.results ?? [];
  let myRank: number | null = null;
  const ranking = rows.map((row, idx) => {
    const rank = idx + 1;
    if (row.account_id === me.id) myRank = rank;
    return { rank, poker_name: row.poker_name };
  });

  return jsonResponse(200, { ranking, my_rank: myRank });
};
