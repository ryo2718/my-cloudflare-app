// /api/ranking[?type=total|season] クライアント。
//
// 仕様:
//   - type=total  : 累計 best_score
//   - type=season : 現シーズンの season_score
//   - 上位 3 ランクのみ total_points 公開、 ただし top3 該当者が表示人数の半数を超えると
//     全員非公開 (hide_points_reason='too_many_top3')
//   - reference は is_ranking_excluded=1 (admin 除外)、 total_points は常に公開
//   - 同点同順位 (1位 40pt が 2 人なら両方 1 位、次は 3 位)

import { AuthApiError } from './auth';

export type RankType = 'total' | 'season';

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
  hide_points_reason: 'too_many_top3' | null;
  type: RankType;
  season: { id: string; number: number; name: string } | null;
}

interface ErrorBody { error?: string }

export async function apiRanking(
  sessionId: string,
  type: RankType = 'total',
): Promise<RankingResponse> {
  const qs = type === 'season' ? '?type=season' : '';
  const res = await fetch(`/api/ranking${qs}`, {
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
