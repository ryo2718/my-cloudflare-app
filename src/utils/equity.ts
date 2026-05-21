// 2 ハンド対決のエクイティ (勝率) を全列挙で計算。
// 確定カード (プレイヤー4枚 + ボード0/3/4/5枚) を除いた残りデッキから、
// 未確定のコミュニティカードを全通り評価する → 正確値。
//   - ボード0 (プリフロップ): 残り48枚から5枚 C(48,5)=1,712,304 通り
//   - ボード3 (フロップ): 残り45枚から2枚 C(45,2)=990 通り
//   - ボード4 (ターン): 残り44枚から1枚 44 通り
//   - ボード5 (リバー): 確定 (1 通り)。100/0 か 50/50。

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
 * Player A (2枚) vs Player B (2枚) のエクイティ。
 * board は確定済みコミュニティカード (0/3/4/5枚) を渡す。
 * カードはすべて重複なし前提 (UI 側で担保)。
 */
export function computeEquity(
  holeA: [Card, Card],
  holeB: [Card, Card],
  board: ReadonlyArray<Card> = [],
): EquityResult {
  const a0 = cardToInt(holeA[0]);
  const a1 = cardToInt(holeA[1]);
  const b0 = cardToInt(holeB[0]);
  const b1 = cardToInt(holeB[1]);
  const bd = board.map(cardToInt);

  const dead = new Set<number>([a0, a1, b0, b1, ...bd]);
  const deck: number[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
  const n = deck.length;

  let winA = 0;
  let winB = 0;
  let tie = 0;

  // 確定ボード + ドロー分を合わせた 5 枚で両者を評価し勝敗を集計。
  const tally = (c0: number, c1: number, c2: number, c3: number, c4: number) => {
    const sa = evaluate7(a0, a1, c0, c1, c2, c3, c4);
    const sb = evaluate7(b0, b1, c0, c1, c2, c3, c4);
    if (sa > sb) winA++;
    else if (sb > sa) winB++;
    else tie++;
  };

  const need = 5 - bd.length;

  if (need === 5) {
    // プリフロップ: 残り 5 枚を全列挙。ホットパスなので inline 比較で高速化。
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
  } else if (need === 0) {
    // リバー: 全カード確定。1 通り。
    tally(bd[0], bd[1], bd[2], bd[3], bd[4]);
  } else if (need === 1) {
    // ターン: 残り 1 枚を全列挙。
    for (let i = 0; i < n; i++) tally(bd[0], bd[1], bd[2], bd[3], deck[i]);
  } else if (need === 2) {
    // フロップ: 残り 2 枚を全列挙。
    for (let i = 0; i < n - 1; i++)
      for (let j = i + 1; j < n; j++) tally(bd[0], bd[1], bd[2], deck[i], deck[j]);
  } else {
    // need 3 or 4 (ボード 1 or 2 枚): 仕様上 UI からは呼ばれないが汎用列挙でフォロー。
    const community = [bd[0] ?? -1, bd[1] ?? -1, bd[2] ?? -1, bd[3] ?? -1, bd[4] ?? -1];
    const choose = (start: number, depth: number): void => {
      if (depth === 5) {
        tally(community[0], community[1], community[2], community[3], community[4]);
        return;
      }
      for (let i = start; i < n; i++) {
        community[depth] = deck[i];
        choose(i + 1, depth + 1);
      }
    };
    choose(0, bd.length);
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
