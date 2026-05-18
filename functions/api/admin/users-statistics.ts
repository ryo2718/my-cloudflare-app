// GET /api/admin/users-statistics
//   Admin 認証必須。
//   全ユーザー (is_admin=0) × レベル (preflop_beginner / preflop_intermediate) の
//   min/max/avg 正答率を返す。 admin 自身はリストに含めない。
//
// 試行 (20問) のグルーピング:
//   problem_attempts を created_at 昇順に取得 → 連続 20 問を 1 試行として扱う。
//   末尾の余り (< 20 問) は不完全な試行として除外。
//
// 正答率: SUM(score_obtained を 2/1/0 にクリップ) / (20 × max_per_problem) × 100
//   - max_per_problem: 中級=2, 初級=1

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import type { Env } from '../../lib/types';

const PROBLEMS_PER_ATTEMPT = 20;
const LEVELS = ['preflop_beginner', 'preflop_intermediate'] as const;
type Level = (typeof LEVELS)[number];

interface UserRow {
  id: number;
  poker_name: string;
}

interface AttemptRow {
  score_obtained: number;
  training_type: string;
  created_at: number;
}

interface TrainingResultRow {
  training_type: string;
  best_score: number;
  total_attempts: number;
}

export interface LevelStats {
  best_score: number;
  total_attempts: number;
  /** problem_attempts ベースで集計した試行回数 (20 問単位、不完全試行は除外)。 */
  measured_attempts: number;
  min_correct_rate: number;
  max_correct_rate: number;
  avg_correct_rate: number;
}

export interface UserStats {
  account_id: number;
  poker_name: string;
  total_points: number;
  levels: Partial<Record<Level, LevelStats | null>>;
}

function maxPerProblem(level: Level): number {
  return level === 'preflop_intermediate' ? 2 : 1;
}

function scoreToPoint(s: number): number {
  if (s >= 2) return 2;
  if (s === 1) return 1;
  return 0;
}

/** 連続 20 問を 1 試行として正答率を計算。 不完全な試行は除外。 */
function attemptRates(attempts: AttemptRow[], level: Level): number[] {
  const max = maxPerProblem(level) * PROBLEMS_PER_ATTEMPT;
  const rates: number[] = [];
  for (let i = 0; i + PROBLEMS_PER_ATTEMPT <= attempts.length; i += PROBLEMS_PER_ATTEMPT) {
    const chunk = attempts.slice(i, i + PROBLEMS_PER_ATTEMPT);
    const scoreSum = chunk.reduce((sum, r) => sum + scoreToPoint(r.score_obtained), 0);
    rates.push((scoreSum / max) * 100);
  }
  return rates;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await resolveAccountFromRequest(env.DB, request);
  if (!me || me.is_admin !== 1) {
    return jsonResponse(403, { error: 'forbidden' });
  }

  // 1. 全 admin 除外ユーザー
  const usersRes = await env.DB
    .prepare(`SELECT id, poker_name FROM accounts WHERE is_admin = 0 ORDER BY id ASC`)
    .all<UserRow>();
  const users = usersRes.results ?? [];
  if (users.length === 0) return jsonResponse(200, { users: [] });

  // 2. 並列で各ユーザーの problem_attempts + training_results を取得
  const out: UserStats[] = await Promise.all(
    users.map(async (u): Promise<UserStats> => {
      const [attemptsRes, trainingRes] = await Promise.all([
        env.DB
          .prepare(
            `SELECT score_obtained, training_type, created_at FROM problem_attempts
             WHERE account_id = ? ORDER BY created_at ASC`,
          )
          .bind(u.id)
          .all<AttemptRow>(),
        env.DB
          .prepare(
            `SELECT training_type, best_score, total_attempts FROM training_results
             WHERE account_id = ?`,
          )
          .bind(u.id)
          .all<TrainingResultRow>(),
      ]);
      const attempts = attemptsRes.results ?? [];
      const training = trainingRes.results ?? [];
      const totalPoints = training.reduce((sum, t) => sum + t.best_score, 0);

      const levels: Partial<Record<Level, LevelStats | null>> = {};
      for (const lv of LEVELS) {
        const lvAttempts = attempts.filter((a) => a.training_type === lv);
        const tr = training.find((t) => t.training_type === lv);
        if (lvAttempts.length < PROBLEMS_PER_ATTEMPT && !tr) {
          levels[lv] = null;
          continue;
        }
        const rates = attemptRates(lvAttempts, lv);
        if (rates.length === 0) {
          // training_results はあるが problem_attempts は不足
          levels[lv] = tr
            ? {
                best_score: tr.best_score,
                total_attempts: tr.total_attempts,
                measured_attempts: 0,
                min_correct_rate: 0,
                max_correct_rate: 0,
                avg_correct_rate: 0,
              }
            : null;
          continue;
        }
        const min = Math.min(...rates);
        const max = Math.max(...rates);
        const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
        levels[lv] = {
          best_score: tr?.best_score ?? 0,
          total_attempts: tr?.total_attempts ?? rates.length,
          measured_attempts: rates.length,
          min_correct_rate: min,
          max_correct_rate: max,
          avg_correct_rate: avg,
        };
      }

      return {
        account_id: u.id,
        poker_name: u.poker_name,
        total_points: totalPoints,
        levels,
      };
    }),
  );

  return jsonResponse(200, { users: out });
};
