// POST /api/account/problem-attempts
// 通常プレイ完了時に全 20 問の挑戦履歴 (正解・不正解問わず) を batch INSERT。
// 復習プレイは送信しない (クライアント側で制御)。

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import type { Env } from '../../lib/types';

const ALLOWED_TRAINING_TYPES = new Set([
  'preflop_beginner',
  'preflop_intermediate',
  // ポストフロップ (正答率集計対象)。
  'flop_beginner',
  'srp_non_blind',
  'srp_limp_blind',
  '3bp_4bp_5bp_non_blind',
  '3bp_4bp_5bp_blind',
  'donk_bmcb',
]);
const ALLOWED_SCENARIOS = new Set([
  'bb_response',
  'vs_3bet',
  'vs_4bet',
  'middle_vs_open',
  'risky_open',
  'beginner_open',
  'beginner_vs_open',
  // フロップ scenario タグ。
  'flop_beginner',
  'flop_cb',
  'flop_donk',
  'flop_bmcb',
]);
const ALLOWED_POSITIONS = new Set(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);

interface AttemptInput {
  training_type: string;
  scenario_type: string;
  hero_position: string;
  opener_position?: string | null;
  three_bettor_position?: string | null;
  hand: string;
  score_obtained: number;
  is_timeout?: boolean;
}

function isValid(r: unknown): r is AttemptInput {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  if (typeof x.training_type !== 'string' || !ALLOWED_TRAINING_TYPES.has(x.training_type)) return false;
  if (typeof x.scenario_type !== 'string' || !ALLOWED_SCENARIOS.has(x.scenario_type)) return false;
  if (typeof x.hero_position !== 'string' || !ALLOWED_POSITIONS.has(x.hero_position)) return false;
  if (
    x.opener_position !== null &&
    x.opener_position !== undefined &&
    !(typeof x.opener_position === 'string' && ALLOWED_POSITIONS.has(x.opener_position))
  ) return false;
  if (
    x.three_bettor_position !== null &&
    x.three_bettor_position !== undefined &&
    !(typeof x.three_bettor_position === 'string' && ALLOWED_POSITIONS.has(x.three_bettor_position))
  ) return false;
  if (typeof x.hand !== 'string' || x.hand.length === 0 || x.hand.length > 4) return false;
  if (typeof x.score_obtained !== 'number' || !Number.isFinite(x.score_obtained)) return false;
  if (x.score_obtained < -1 || x.score_obtained > 2) return false;
  return true;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) return jsonResponse(401, { error: 'unauthorized' });

  let body: { records?: unknown };
  try {
    body = (await request.json()) as { records?: unknown };
  } catch {
    return jsonResponse(400, { error: 'invalid_payload' });
  }
  if (!Array.isArray(body.records)) return jsonResponse(400, { error: 'invalid_payload' });
  if (body.records.length > 50) return jsonResponse(400, { error: 'too_many_records' });

  const valid: AttemptInput[] = [];
  for (const r of body.records) {
    if (isValid(r)) valid.push(r);
  }
  if (valid.length === 0) return jsonResponse(200, { inserted: 0 });

  const now = Date.now();
  const stmts = valid.map((r) =>
    env.DB
      .prepare(
        `INSERT INTO problem_attempts
         (account_id, training_type, scenario_type, hero_position,
          opener_position, three_bettor_position, hand,
          score_obtained, is_timeout, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        account.id,
        r.training_type,
        r.scenario_type,
        r.hero_position,
        r.opener_position ?? null,
        r.three_bettor_position ?? null,
        r.hand,
        r.score_obtained,
        r.is_timeout ? 1 : 0,
        now,
      ),
  );
  await env.DB.batch(stmts);
  return jsonResponse(200, { inserted: valid.length });
};
