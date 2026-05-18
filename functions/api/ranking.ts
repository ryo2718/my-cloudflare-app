// GET /api/ranking
//   Header: Authorization: Bearer <session_id>
//   Response 200: {
//     ranking: [{ rank, poker_name, points_visible, total_points }],
//     reference: [{ poker_name, total_points }],
//     my_rank: number | null
//   }
//   Response 401: { error: 'unauthorized' }
//
// 仕様:
//   - 通常ランキング: is_admin=0 AND is_ranking_excluded=0
//     ・total_points DESC、同点は accounts.id ASC でタイブレイク
//     ・同点同順位 (1位 40pt が 2 人なら両方 1 位、次は 3 位)
//     ・rank <= 3 のみ total_points を公開、それ以下は null + points_visible=false
//   - 参考枠 (reference): is_admin=0 AND is_ranking_excluded=1
//     ・末尾に表示、 total_points は常に公開
//   - admin (is_admin=1) はランキング・参考の両方から除外
//   - my_rank: 自分が通常ランキングに含まれる場合の順位、含まれない (admin / 除外) なら null

import { jsonResponse, resolveAccountFromRequest } from '../lib/auth';
import type { Env } from '../lib/types';

interface RankingRow {
  account_id: number;
  poker_name: string;
  total_points: number;
}

interface ReferenceRow {
  poker_name: string;
  total_points: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await resolveAccountFromRequest(env.DB, request);
  if (!me) return jsonResponse(401, { error: 'unauthorized' });

  // 通常ランキング (admin と is_ranking_excluded を除外)
  const rankingRes = await env.DB
    .prepare(
      `SELECT
         a.id AS account_id,
         a.poker_name,
         COALESCE(SUM(t.best_score), 0) AS total_points
       FROM accounts a
       LEFT JOIN training_results t ON a.id = t.account_id
       WHERE a.is_admin = 0 AND a.is_ranking_excluded = 0
       GROUP BY a.id, a.poker_name
       ORDER BY total_points DESC, a.id ASC`,
    )
    .all<RankingRow>();

  // 参考枠 (is_ranking_excluded のみ、 admin 除外)
  const referenceRes = await env.DB
    .prepare(
      `SELECT
         a.poker_name,
         COALESCE(SUM(t.best_score), 0) AS total_points
       FROM accounts a
       LEFT JOIN training_results t ON a.id = t.account_id
       WHERE a.is_admin = 0 AND a.is_ranking_excluded = 1
       GROUP BY a.id, a.poker_name
       ORDER BY total_points DESC, a.id ASC`,
    )
    .all<ReferenceRow>();

  const ranking = buildRanking(rankingRes.results ?? [], me.id);
  const reference = (referenceRes.results ?? []).map((r) => ({
    poker_name: r.poker_name,
    total_points: r.total_points,
  }));

  return jsonResponse(200, {
    ranking: ranking.entries,
    reference,
    my_rank: ranking.myRank,
  });
};

/**
 * 同点同順位 + 上位 3 位の pt 公開ロジック。
 *  - 同点なら同じ順位 (1, 1, 3, 4, ...)
 *  - rank <= 3 のみ total_points を返す、それ以下は null
 */
function buildRanking(
  rows: ReadonlyArray<RankingRow>,
  meId: number,
): {
  entries: { rank: number; poker_name: string; points_visible: boolean; total_points: number | null }[];
  myRank: number | null;
} {
  let myRank: number | null = null;
  let currentRank = 0;
  let prevPoints: number | null = null;
  const entries = rows.map((row, idx) => {
    if (row.total_points !== prevPoints) {
      currentRank = idx + 1;
      prevPoints = row.total_points;
    }
    if (row.account_id === meId) myRank = currentRank;
    const pointsVisible = currentRank <= 3;
    return {
      rank: currentRank,
      poker_name: row.poker_name,
      points_visible: pointsVisible,
      total_points: pointsVisible ? row.total_points : null,
    };
  });
  return { entries, myRank };
}
