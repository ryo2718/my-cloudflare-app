// /api/account/* client。AccountPage で使う profile detail を fetch。

import { AuthApiError } from './auth';

export interface TrainingResult {
  id: number;
  account_id: number;
  training_type: string;
  best_score: number;
  best_score_at: number;
  total_attempts: number;
  updated_at: number;
}

export interface AccountDetail {
  poker_name: string;
  points: number;
  training_results: TrainingResult[];
}

export interface TrainingResultSubmission {
  is_best: boolean;
  previous_best: number;
  current_best: number;
  total_attempts: number;
}

interface ErrorBody { error?: string }

async function fetchJsonAuthed<T>(url: string, sessionId: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  if (res.ok) return (await res.json()) as T;
  let code: string | undefined;
  try {
    const body = (await res.json()) as ErrorBody;
    code = typeof body.error === 'string' ? body.error : undefined;
  } catch {
    // ignore
  }
  throw new AuthApiError(code ?? `http_${res.status}`, res.status);
}

export async function apiAccountMe(sessionId: string): Promise<AccountDetail> {
  return await fetchJsonAuthed<AccountDetail>('/api/account/me', sessionId);
}

export async function apiAccountTrainingResults(
  sessionId: string,
): Promise<TrainingResult[]> {
  const res = await fetchJsonAuthed<{ training_results: TrainingResult[] }>(
    '/api/account/training-results',
    sessionId,
  );
  return res.training_results;
}

export async function apiSubmitTrainingResult(
  sessionId: string,
  body: { training_type: string; score: number },
): Promise<TrainingResultSubmission> {
  const res = await fetch('/api/account/training-result', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionId}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let code: string | undefined;
    try {
      const j = (await res.json()) as { error?: string };
      code = typeof j.error === 'string' ? j.error : undefined;
    } catch {
      // ignore
    }
    throw new AuthApiError(code ?? `http_${res.status}`, res.status);
  }
  return (await res.json()) as TrainingResultSubmission;
}

/**
 * DELETE /api/account/reset-results
 * 自分の training_results のみ削除 (problem_attempts / missed_problems は残す)。
 * is_admin=1 or is_ranking_excluded=1 のユーザーのみ実行可、それ以外は 403。
 */
export async function apiResetResults(sessionId: string): Promise<{ deleted: number }> {
  const res = await fetch('/api/account/reset-results', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  if (!res.ok) {
    let code: string | undefined;
    try {
      const j = (await res.json()) as { error?: string };
      code = typeof j.error === 'string' ? j.error : undefined;
    } catch {
      // ignore
    }
    throw new AuthApiError(code ?? `http_${res.status}`, res.status);
  }
  return (await res.json()) as { deleted: number };
}
