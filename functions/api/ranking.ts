// GET /api/ranking[?type=total|season]
//   Header: Authorization: Bearer <session_id>
//   Response 200: {
//     ranking: [{ rank, poker_name, points_visible, total_points }],
//     reference: [{ poker_name, total_points }],
//     my_rank: number | null,
//     hide_points_reason: 'too_many_top3' | null,
//     type: 'total' | 'season',
//     season: { id, number, name } | null,
//   }
//   Response 401: { error: 'unauthorized' }
//
// 仕様:
//   - type=total  : COALESCE(SUM(t.best_score), 0)   (累計)
//   - type=season : COALESCE(SUM(season_score CASE...), 0)  (現シーズン分のみ)
//   - 通常ランキング: is_admin=0 AND is_ranking_excluded=0
//     ・total_points DESC、 同点は accounts.id ASC でタイブレイク
//     ・同点同順位 (1位 40pt が 2 人なら両方 1 位、 次は 3 位)
//     ・rank <= 3 のみ pt 公開、 ただし top3 該当者が表示人数の半数を超える場合は
//       全員 pt 非公開 (hide_points_reason='too_many_top3')
//   - 参考枠: is_admin=0 AND is_ranking_excluded=1 (pt は常に公開)
//   - admin (is_admin=1) はランキング・参考の両方から除外
//   - my_rank: 自分が通常ランキングに含まれる場合の順位、含まれなければ null

import { jsonResponse, resolveAccountFromRequest } from '../lib/auth';
import { currentSeason } from '../lib/season';
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

type RankType = 'total' | 'season';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await resolveAccountFromRequest(env.DB, request);
  if (!me) return jsonResponse(401, { error: 'unauthorized' });

  const url = new URL(request.url);
  const type: RankType = url.searchParams.get('type') === 'season' ? 'season' : 'total';
  const season = currentSeason();

  // 集計値の SQL 式
  //   total : SUM(best_score)
  //   season: SUM(season_score) ただし season_id が現シーズンと一致する行のみ
  const sumExpr =
    type === 'season'
      ? `COALESCE(SUM(CASE WHEN t.season_id = ? THEN t.season_score ELSE 0 END), 0)`
      : `COALESCE(SUM(t.best_score), 0)`;

  const rankingSql = `
    SELECT a.id AS account_id, a.poker_name, ${sumExpr} AS total_points
    FROM accounts a
    LEFT JOIN training_results t ON a.id = t.account_id
    WHERE a.is_admin = 0 AND a.is_ranking_excluded = 0
    GROUP BY a.id, a.poker_name
    ORDER BY total_points DESC, a.id ASC
  `;
  const referenceSql = `
    SELECT a.poker_name, ${sumExpr} AS total_points
    FROM accounts a
    LEFT JOIN training_results t ON a.id = t.account_id
    WHERE a.is_admin = 0 AND a.is_ranking_excluded = 1
    GROUP BY a.id, a.poker_name
    ORDER BY total_points DESC, a.id ASC
  `;

  const rankingStmt = env.DB.prepare(rankingSql);
  const referenceStmt = env.DB.prepare(referenceSql);
  const rankingRes = await (type === 'season'
    ? rankingStmt.bind(season.id)
    : rankingStmt
  ).all<RankingRow>();
  const referenceRes = await (type === 'season'
    ? referenceStmt.bind(season.id)
    : referenceStmt
  ).all<ReferenceRow>();

  const computed = buildRanking(rankingRes.results ?? [], me.id);
  const reference = (referenceRes.results ?? []).map((r) => ({
    poker_name: r.poker_name,
    total_points: r.total_points,
  }));

  return jsonResponse(200, {
    ranking: computed.entries,
    reference,
    my_rank: computed.myRank,
    hide_points_reason: computed.hidePointsReason,
    type,
    season: type === 'season' ? season : null,
  });
};

/**
 * 同点同順位 + 上位 3 ランクの pt 公開ロジック + 半数超で全 pt 非公開。
 *  - 同点なら同じ順位 (1, 1, 3, 4, ...)
 *  - 通常は rank <= 3 のみ pt 公開
 *  - top3 該当者数が ranking 全体の半数より多い場合は全員非公開
 */
function buildRanking(
  rows: ReadonlyArray<RankingRow>,
  meId: number,
): {
  entries: { rank: number; poker_name: string; points_visible: boolean; total_points: number | null }[];
  myRank: number | null;
  hidePointsReason: 'too_many_top3' | null;
} {
  // 第 1 パス: rank を割り当てる (同点同順位)
  let currentRank = 0;
  let prevPoints: number | null = null;
  const ranked = rows.map((row, idx) => {
    if (row.total_points !== prevPoints) {
      currentRank = idx + 1;
      prevPoints = row.total_points;
    }
    return { ...row, rank: currentRank };
  });

  // 第 2 パス: 半数超チェック (例: 6 人中 top3 該当が 4 人 → hide)
  const top3Count = ranked.filter((r) => r.rank <= 3).length;
  const hide = top3Count > ranked.length / 2;

  let myRank: number | null = null;
  const entries = ranked.map((row) => {
    if (row.account_id === meId) myRank = row.rank;
    const visible = !hide && row.rank <= 3;
    return {
      rank: row.rank,
      poker_name: row.poker_name,
      points_visible: visible,
      total_points: visible ? row.total_points : null,
    };
  });

  return {
    entries,
    myRank,
    hidePointsReason: hide ? 'too_many_top3' : null,
  };
}
