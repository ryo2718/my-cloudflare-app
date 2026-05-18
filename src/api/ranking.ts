// /api/ranking クライアント。
//
// レスポンス例:
//   { ranking: [{rank: 1, poker_name: "たろう"}, ...], my_rank: 4 | null }

import { AuthApiError } from './auth';

export interface RankingEntry {
  rank: number;
  poker_name: string;
}

export interface RankingResponse {
  ranking: RankingEntry[];
  my_rank: number | null;
}

interface ErrorBody { error?: string }

export async function apiRanking(sessionId: string): Promise<RankingResponse> {
  const res = await fetch('/api/ranking', {
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  if (res.ok) return (await res.json()) as RankingResponse;
  let code: string | undefined;
  try {
    const j = (await res.json()) as ErrorBody;
    code = typeof j.error === 'string' ? j.error : undefined;
  } catch {
    // ignore
  }
  throw new AuthApiError(code ?? `http_${res.status}`, res.status);
}
