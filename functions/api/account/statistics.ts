// GET /api/account/statistics
// 自分の problem_attempts を集計してポジション別・シナリオ別の正答率を返す。
//
// 正答率の式:
//   score_sum = SUM(score_obtained を 2/1/0 にクリップ)
//     (-1 と 0 は 0pt 扱い、1 は 1pt、2 は 2pt)
//   max_sum = SUM(問題ごとの理論最大: 初級=1, 中級=2)
//   correctRate = score_sum / max_sum * 100

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import type { Env } from '../../lib/types';

interface AggRow {
  key: string;
  total: number;
  score_sum: number;
  max_sum: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) return jsonResponse(401, { error: 'unauthorized' });

  const SCORE_EXPR = `(CASE
      WHEN score_obtained >= 2 THEN 2
      WHEN score_obtained = 1 THEN 1
      ELSE 0
    END)`;
  // 1 問の理論最大点。 中級総合・フロップ中級 (CB/ドンク) は 2pt、 それ以外は 1pt。
  const MAX_EXPR = `(CASE
      WHEN training_type IN ('preflop_intermediate', 'srp_non_blind', 'srp_limp_blind', '3bp_4bp_5bp_non_blind', '3bp_4bp_5bp_blind', 'donk_bmcb') THEN 2
      ELSE 1
    END)`;

  // ポジション別 / シナリオ別はプリフロップのみ集計 (ポストフロップはモード別で表示し、 混在を避ける)。
  const posSql = `
    SELECT hero_position AS key,
           COUNT(*) AS total,
           SUM(${SCORE_EXPR}) AS score_sum,
           SUM(${MAX_EXPR}) AS max_sum
    FROM problem_attempts
    WHERE account_id = ? AND training_type LIKE 'preflop_%'
    GROUP BY hero_position
    ORDER BY hero_position
  `;
  const scenSql = `
    SELECT scenario_type AS key,
           COUNT(*) AS total,
           SUM(${SCORE_EXPR}) AS score_sum,
           SUM(${MAX_EXPR}) AS max_sum
    FROM problem_attempts
    WHERE account_id = ? AND training_type LIKE 'preflop_%'
    GROUP BY scenario_type
    ORDER BY scenario_type
  `;
  // 全体 (レベル別)
  const levelSql = `
    SELECT training_type AS key,
           COUNT(*) AS total,
           SUM(${SCORE_EXPR}) AS score_sum,
           SUM(${MAX_EXPR}) AS max_sum
    FROM problem_attempts
    WHERE account_id = ?
    GROUP BY training_type
  `;

  const [byPosRes, byScenRes, byLevelRes] = await Promise.all([
    env.DB.prepare(posSql).bind(account.id).all<AggRow>(),
    env.DB.prepare(scenSql).bind(account.id).all<AggRow>(),
    env.DB.prepare(levelSql).bind(account.id).all<AggRow>(),
  ]);

  const mapRows = (rows: AggRow[] | undefined) =>
    (rows ?? []).map((r) => ({
      key: r.key,
      total: r.total,
      score_sum: r.score_sum,
      max_sum: r.max_sum,
      correct_rate: r.max_sum > 0 ? (r.score_sum / r.max_sum) * 100 : 0,
    }));

  return jsonResponse(200, {
    by_position: mapRows(byPosRes.results),
    by_scenario: mapRows(byScenRes.results),
    by_level: mapRows(byLevelRes.results),
  });
};
