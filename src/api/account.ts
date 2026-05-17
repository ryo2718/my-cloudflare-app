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
