// /api/account/problem-attempts (POST) + /api/account/statistics (GET) クライアント。

import { AuthApiError } from './auth';

export interface ProblemAttemptInput {
  training_type: 'preflop_beginner' | 'preflop_intermediate';
  scenario_type: string;
  hero_position: string;
  opener_position?: string | null;
  three_bettor_position?: string | null;
  hand: string;
  score_obtained: number;
  is_timeout?: boolean;
}

export interface StatGroup {
  key: string;
  total: number;
  score_sum: number;
  max_sum: number;
  correct_rate: number;
}

export interface StatisticsResponse {
  by_position: StatGroup[];
  by_scenario: StatGroup[];
  by_level: StatGroup[];
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

export async function apiPostProblemAttempts(
  sessionId: string,
  records: ProblemAttemptInput[],
): Promise<{ inserted: number }> {
  const res = await fetch('/api/account/problem-attempts', {
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

export async function apiGetStatistics(sessionId: string): Promise<StatisticsResponse> {
  const res = await fetch('/api/account/statistics', {
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  await throwIfNotOk(res);
  return (await res.json()) as StatisticsResponse;
}
