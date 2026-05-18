// 中級スコア内訳 (4 部門) の集計ヘルパー。
//
// 各問題の finalScore を:
//   - 2pt → ◎ 満点
//   - 1pt → ○ 部分点
//   - 0pt → △ 無回答
//   - -1pt (時間切れ含む) → ✕ ミス

import type { IntermediateRecord } from '../../data/training/recordsStore';

export interface ScoreBreakdown {
  perfect: number;
  partial: number;
  zero: number;
  miss: number;
  total: number;
}

export function computeScoreBreakdown(
  records: ReadonlyArray<IntermediateRecord>,
): ScoreBreakdown {
  let perfect = 0;
  let partial = 0;
  let zero = 0;
  let miss = 0;
  for (const r of records) {
    if (r.finalScore >= 2) perfect++;
    else if (r.finalScore === 1) partial++;
    else if (r.finalScore === 0) zero++;
    else miss++;
  }
  return { perfect, partial, zero, miss, total: records.length };
}

/** percent (0-100) を整数または小数 1 桁で表示。total=0 のとき 0。 */
export function breakdownPct(count: number, total: number): number {
  if (total <= 0) return 0;
  return (count / total) * 100;
}
