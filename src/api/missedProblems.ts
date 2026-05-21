// /api/account/missed-problems* クライアント。
//
// Step 1 では中級トレーニング完了時に POST して満点未達の記録を残す。
// 取得・削除 API も用意 (UI は Step 2 で接続)。

import { AuthApiError } from './auth';

export interface MissedProblemRow {
  id: number;
  account_id: number;
  training_type: string;
  scenario_type: string;
  hero_position: string;
  opener_position: string | null;
  three_bettor_position: string | null;
  hand: string;
  user_selections: string;  // JSON
  gto_strategy: string;     // JSON
  score_obtained: number;
  is_timeout: number;
  is_removed_from_review: number;
  created_at: number;
}

export type MissedTrainingType =
  | 'preflop_beginner'
  | 'preflop_intermediate'
  | 'preflop_intermediate_ep'
  | 'preflop_intermediate_lp'
  | 'preflop_intermediate_blind';

/** 取得用 level クエリ。 */
export type MissedLevel = 'beginner' | 'intermediate' | 'ep' | 'lp' | 'blind';

export interface MissedProblemInput {
  training_type: MissedTrainingType;
  scenario_type: string;
  hero_position: string;
  opener_position?: string | null;
  three_bettor_position?: string | null;
  hand: string;
  /** 複数選択は ['raise','call'] 等。スライダーは ['__slider__','<回答%>']。 */
  user_selections: string[];
  /** check はポジション別 (BB vs limp) でのみ使用。 */
  gto_strategy: { allin: number; raise: number; call: number; fold: number; check?: number };
  score_obtained: number;
  is_timeout?: boolean;
}

interface ErrorBody { error?: string }

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  let code: string | undefined;
  try {
    const j = (await res.json()) as ErrorBody;
    code = typeof j.error === 'string' ? j.error : undefined;
  } catch {
    // ignore
  }
  throw new AuthApiError(code ?? `http_${res.status}`, res.status);
}

export async function apiPostMissedProblems(
  sessionId: string,
  records: MissedProblemInput[],
): Promise<{ inserted: number }> {
  const res = await fetch('/api/account/missed-problems', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionId}`,
    },
    body: JSON.stringify({ records }),
  });
  await throwIfNotOk(res);
  return (await res.json()) as { inserted: number };
}

export async function apiGetMissedProblems(
  sessionId: string,
  params: { level?: MissedLevel; limit?: number; includeRemoved?: boolean } = {},
): Promise<MissedProblemRow[]> {
  const qs = new URLSearchParams();
  if (params.level) qs.set('level', params.level);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.includeRemoved) qs.set('include_removed', 'true');
  const res = await fetch(`/api/account/missed-problems?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  await throwIfNotOk(res);
  const body = (await res.json()) as { problems: MissedProblemRow[] };
  return body.problems;
}

export async function apiRemoveMissedProblem(sessionId: string, id: number): Promise<void> {
  const res = await fetch(`/api/account/missed-problems/${id}/remove`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  await throwIfNotOk(res);
}
