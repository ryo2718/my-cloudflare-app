// GET  /api/account/missed-problems       一覧取得 (ランダム、limit 適用)
// POST /api/account/missed-problems       バッチ INSERT (採点後にクライアントから呼ぶ)
//
// 認証必須。 自分の account_id の record のみアクセス可能。

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import type { Env, MissedProblemRow } from '../../lib/types';

const ALLOWED_TRAINING_TYPES = new Set([
  'preflop_beginner',
  'preflop_intermediate',
  // 中級ポジション別 (EP/LP/Blind)
  'preflop_intermediate_ep',
  'preflop_intermediate_lp',
  'preflop_intermediate_blind',
  // ポストフロップ (フロップ)。フロップ固有情報は metadata(JSON)に持つ。
  'flop_beginner',
  'flop_cb_srp',
  'flop_cb_3bp',
  'flop_donk_bmcb',
]);
const ALLOWED_SCENARIOS = new Set([
  'bb_response',
  'vs_3bet',
  'vs_4bet',
  'middle_vs_open',
  'risky_open',
  'beginner_open',
  'beginner_vs_open',
  // 中級ポジション別シナリオ
  'ep_open', 'ep_vs_3bet', 'ep_vs_4bet',
  'lp_open', 'lp_vs_open_btn', 'lp_vs_open_co', 'lp_vs_3bet', 'lp_vs_4bet',
  'sb_open', 'sb_limp_vs_raise', 'sb_vs_3bet', 'sb_vs_4bet', 'sb_vs_open',
  'bb_vs_open_other', 'bb_vs_open_sb', 'bb_vs_limp', 'bb_vs_limp_raise', 'bb_vs_4bet',
  // フロップ scenario_type (種別タグ)。詳細は metadata に持つ。
  'flop_cb', 'flop_donk', 'flop_bmcb', 'flop_beginner',
]);
const ALLOWED_POSITIONS = new Set(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);

/** フロップ training_type か。 */
function isFlopType(t: string): boolean {
  return t.startsWith('flop_');
}

/** level クエリ → training_type。フロップは level=training_type をそのまま使う。 */
const LEVEL_TO_TRAINING_TYPE: Record<string, string> = {
  beginner: 'preflop_beginner',
  intermediate: 'preflop_intermediate',
  ep: 'preflop_intermediate_ep',
  lp: 'preflop_intermediate_lp',
  blind: 'preflop_intermediate_blind',
};

/** level クエリを training_type へ解決 (フロップは flop_* をそのまま許可)。 */
function resolveTrainingType(level: string): string {
  if (LEVEL_TO_TRAINING_TYPE[level]) return LEVEL_TO_TRAINING_TYPE[level];
  if (isFlopType(level) && ALLOWED_TRAINING_TYPES.has(level)) return level;
  return 'preflop_intermediate';
}

/** 取得 limit の上限。 */
const MAX_LIMIT = 1000;

// ---------------------------------------------------------------------------
// GET: 自分の missed_problems を取得
// ---------------------------------------------------------------------------

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) return jsonResponse(401, { error: 'unauthorized' });

  const url = new URL(request.url);
  const level = url.searchParams.get('level') ?? 'intermediate';
  const trainingType = resolveTrainingType(level);
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '10', 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(MAX_LIMIT, Math.max(1, limitRaw))
    : 10;
  const includeRemoved = url.searchParams.get('include_removed') === 'true';

  const sql = includeRemoved
    ? `SELECT * FROM missed_problems
       WHERE account_id = ? AND training_type = ?
       ORDER BY RANDOM()
       LIMIT ?`
    : `SELECT * FROM missed_problems
       WHERE account_id = ? AND training_type = ? AND is_removed_from_review = 0
       ORDER BY RANDOM()
       LIMIT ?`;

  const res = await env.DB
    .prepare(sql)
    .bind(account.id, trainingType, limit)
    .all<MissedProblemRow>();

  return jsonResponse(200, { problems: res.results ?? [] });
};

// ---------------------------------------------------------------------------
// POST: バッチ INSERT
// body: { records: MissedProblemInput[] }
// ---------------------------------------------------------------------------

interface MissedProblemInput {
  training_type: string;
  scenario_type: string;
  hero_position: string;
  opener_position?: string | null;
  three_bettor_position?: string | null;
  hand: string;
  user_selections: string[];
  gto_strategy: { allin: number; raise: number; call: number; fold: number };
  score_obtained: number;
  is_timeout?: boolean;
  /** フロップ固有情報 (board / pot / variant / kind / hand) を JSON 文字列で持つ。 */
  metadata?: string | null;
}

function isValidRecord(r: unknown): r is MissedProblemInput {
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
  if (!Array.isArray(x.user_selections)) return false;
  if (!x.gto_strategy || typeof x.gto_strategy !== 'object') return false;
  if (typeof x.score_obtained !== 'number' || !Number.isFinite(x.score_obtained)) return false;
  if (x.score_obtained < -1 || x.score_obtained > 2) return false;
  // フロップは再出題に必要な metadata (board/variant を含む JSON) を必須にする。
  if (isFlopType(x.training_type)) {
    if (typeof x.metadata !== 'string' || x.metadata.length === 0 || x.metadata.length > 500) return false;
    try {
      const m = JSON.parse(x.metadata) as Record<string, unknown>;
      if (typeof m.board !== 'string' || typeof m.variant !== 'string') return false;
    } catch {
      return false;
    }
  } else if (x.metadata !== null && x.metadata !== undefined && typeof x.metadata !== 'string') {
    return false;
  }
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
  if (!Array.isArray(body.records)) {
    return jsonResponse(400, { error: 'invalid_payload' });
  }
  // 1 リクエスト最大 50 件 (= 中級 20 問 + 余裕)
  if (body.records.length > 50) {
    return jsonResponse(400, { error: 'too_many_records' });
  }

  const validRecords: MissedProblemInput[] = [];
  for (const r of body.records) {
    if (isValidRecord(r)) validRecords.push(r);
  }

  if (validRecords.length === 0) {
    return jsonResponse(200, { inserted: 0 });
  }

  const now = Date.now();
  const stmts = validRecords.map((r) =>
    env.DB
      .prepare(
        `INSERT INTO missed_problems
         (account_id, training_type, scenario_type, hero_position,
          opener_position, three_bettor_position, hand,
          user_selections, gto_strategy, score_obtained,
          is_timeout, is_removed_from_review, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .bind(
        account.id,
        r.training_type,
        r.scenario_type,
        r.hero_position,
        r.opener_position ?? null,
        r.three_bettor_position ?? null,
        r.hand,
        JSON.stringify(r.user_selections),
        JSON.stringify(r.gto_strategy),
        r.score_obtained,
        r.is_timeout ? 1 : 0,
        now,
        r.metadata ?? null,
      ),
  );
  await env.DB.batch(stmts);

  return jsonResponse(200, { inserted: validRecords.length });
};
