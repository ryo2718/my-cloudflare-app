// /api/ranking クライアント。
//
// レスポンス例:
//   {
//     ranking: [{rank: 1, poker_name: "たろう", points_visible: true, total_points: 40}, ...],
//     reference: [{poker_name: "ryoji", total_points: 28}, ...],
//     my_rank: 4 | null
//   }
//
// 仕様:
//   - 上位 3 位の total_points のみ公開、それ以下は null
//   - reference は is_ranking_excluded=1 のユーザー (admin 除外)、 total_points は常に公開
//   - 同点同順位 (1位 40pt が 2 人なら両方 1 位、次は 3 位)

import { AuthApiError } from './auth';

export interface RankingEntry {
  rank: number;
  poker_name: string;
  points_visible: boolean;
  total_points: number | null;
}

export interface ReferenceEntry {
  poker_name: string;
  total_points: number;
}

export interface RankingResponse {
  ranking: RankingEntry[];
  reference: ReferenceEntry[];
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
