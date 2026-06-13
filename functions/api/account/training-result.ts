// POST /api/account/training-result
//   Header: Authorization: Bearer <session_id>
//   Body: { training_type: string, score: number }
//   Response 200: { is_best, previous_best, current_best, total_attempts }
//   Response 400: { error: 'invalid_payload' }
//   Response 401: { error: 'unauthorized' }
//
// Upsert ロジック:
//   1. account_id + training_type で既存検索
//   2. 無し → 新規 INSERT (best_score=score, total_attempts=1)
//   3. 有り → total_attempts +=1, score > best_score なら best_score 更新
//   4. updated_at 常に更新
//
// 注: score の妥当性 (0 <= score <= 20 など) は best 数のみ参照するためサーバ側で
//      ストレージ整合性を破る危険は低いが、明らかな負値や巨大値は拒否。

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import { evaluateAchievements } from '../../lib/achievements';
import { currentSeason } from '../../lib/season';
import type { Env, TrainingResultRow } from '../../lib/types';

interface Body {
  training_type?: unknown;
  score?: unknown;
}

const TRAINING_TYPES = new Set<string>([
  'preflop_beginner',
  // 初級オープン (open 頻度スライダー・優しい採点)。best_score は正解数 (0-20)。
  'preflop_beginner_open',
  // 初級 vs オープン (複数選択・優しい採点)。best_score は正解数 (0-20)。
  'preflop_beginner_vs_open',
  'preflop_intermediate',
  // 中級ポジション別 (EP/LP/Blind)
  'preflop_intermediate_ep',
  'preflop_intermediate_lp',
  'preflop_intermediate_blind',
  'preflop_advanced',
  'preflop_expert',
  'flop_beginner',
  'flop_intermediate',
  'flop_intermediate_cb',
  // CB レンジベット (SRP / 3BP4BP5BP) / ドンク・BMCB
  'flop_cb_srp',
  'flop_cb_3bp',
  'flop_donk_bmcb',
  'flop_advanced',
  'flop_expert',
]);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) {
    return jsonResponse(401, { error: 'unauthorized' });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonResponse(400, { error: 'invalid_payload' });
  }
  const trainingType = body.training_type;
  const score = body.score;
  if (
    typeof trainingType !== 'string' ||
    !TRAINING_TYPES.has(trainingType) ||
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > 100
  ) {
    return jsonResponse(400, { error: 'invalid_payload' });
  }

  const now = Date.now();
  const season = currentSeason();
  const existing = await env.DB
    .prepare(
      'SELECT * FROM training_results WHERE account_id = ? AND training_type = ?',
    )
    .bind(account.id, trainingType)
    .first<TrainingResultRow>();

  if (!existing) {
    await env.DB
      .prepare(
        `INSERT INTO training_results
         (account_id, training_type, best_score, best_score_at, total_attempts, updated_at,
          season_score, season_id)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .bind(account.id, trainingType, score, now, now, score, season.id)
      .run();
    // 新規ユーザー: 実績判定を試行 (failed query は無視して結果保存自体は成功扱い)
    await evaluateAchievements(env.DB, account.id).catch(() => {});
    return jsonResponse(200, {
      is_best: true,
      previous_best: 0,
      current_best: score,
      total_attempts: 1,
    });
  }

  const previousBest = existing.best_score;
  const isBest = score > previousBest;
  const newBest = isBest ? score : previousBest;
  const newAttempts = existing.total_attempts + 1;

  // シーズン判定:
  //   - 異なるシーズン (= シーズン跨ぎでこの training_type を初プレイ): season_score = score でリセット
  //   - 同シーズン:                                                  season_score = max(prev, score)
  const sameSeason = existing.season_id === season.id;
  const newSeasonScore = sameSeason
    ? Math.max(existing.season_score, score)
    : score;
  const newSeasonId = season.id;

  await env.DB
    .prepare(
      `UPDATE training_results
       SET best_score = ?, best_score_at = ?, total_attempts = ?, updated_at = ?,
           season_score = ?, season_id = ?
       WHERE id = ?`,
    )
    .bind(
      newBest,
      isBest ? now : existing.best_score_at,
      newAttempts,
      now,
      newSeasonScore,
      newSeasonId,
      existing.id,
    )
    .run();

  await evaluateAchievements(env.DB, account.id).catch(() => {});

  return jsonResponse(200, {
    is_best: isBest,
    previous_best: previousBest,
    current_best: newBest,
    total_attempts: newAttempts,
  });
};
