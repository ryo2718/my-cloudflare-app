// プリフロップ 2 ハンド対決のエクイティ (勝率) を全列挙で計算。
// 残り 48 枚から 5 枚のコミュニティを全通り (C(48,5)=1,712,304) 評価する → 正確値。

import type { Card } from '../types/card';
import { cardToInt, evaluate7 } from './handEvaluator';

export interface EquityResult {
  /** Player A の勝率 (%) = (勝ち + 引分/2) / 総数。 */
  a: number;
  /** Player B の勝率 (%)。 */
  b: number;
  /** 引き分けの割合 (%)。 */
  tie: number;
  /** 評価したボード総数。 */
  total: number;
}

/**
 * Player A (2枚) vs Player B (2枚) のプリフロップエクイティ。
 * カードはすべて重複なし前提 (UI 側で担保)。
 */
export function computeEquity(holeA: [Card, Card], holeB: [Card, Card]): EquityResult {
  const a0 = cardToInt(holeA[0]);
  const a1 = cardToInt(holeA[1]);
  const b0 = cardToInt(holeB[0]);
  const b1 = cardToInt(holeB[1]);

  const dead = new Set([a0, a1, b0, b1]);
  const deck: number[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
  const n = deck.length; // 48

  let winA = 0;
  let winB = 0;
  let tie = 0;

  // C(48,5) を 5 重ループで全列挙。
  for (let i = 0; i < n - 4; i++) {
    const d0 = deck[i];
    for (let j = i + 1; j < n - 3; j++) {
      const d1 = deck[j];
      for (let k = j + 1; k < n - 2; k++) {
        const d2 = deck[k];
        for (let l = k + 1; l < n - 1; l++) {
          const d3 = deck[l];
          for (let m = l + 1; m < n; m++) {
            const d4 = deck[m];
            const sa = evaluate7(a0, a1, d0, d1, d2, d3, d4);
            const sb = evaluate7(b0, b1, d0, d1, d2, d3, d4);
            if (sa > sb) winA++;
            else if (sb > sa) winB++;
            else tie++;
          }
        }
      }
    }
  }

  const total = winA + winB + tie;
  if (total === 0) return { a: 0, b: 0, tie: 0, total: 0 };
  return {
    a: ((winA + tie / 2) / total) * 100,
    b: ((winB + tie / 2) / total) * 100,
    tie: (tie / total) * 100,
    total,
  };
}
