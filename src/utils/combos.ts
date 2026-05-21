// 169 ハンド (13×13 マトリクス) ↔ 具体コンボ (1326 通り) の展開ヘルパー。
//   - ハンド: pair (AA) / suited (AKs) / offsuit (AKo)
//   - コンボ: 具体的な 2 枚 (例 AhKs)。canonical key は cardToInt の大きい方を先頭にした 4 文字
//     (例 "AhKs")。順序非依存で一意。
//
// レンジは「選択中コンボ key の Set<string>」で表す。

import { RANKS, SUITS, stringToCard, type Card, type Rank } from '../types/card';
import { cardToInt } from './handEvaluator';

export type HandKind = 'pair' | 'suited' | 'offsuit';

export interface MatrixHand {
  /** 高い方のランク (pair は hi===lo)。 */
  hi: Rank;
  /** 低い方のランク。 */
  lo: Rank;
  kind: HandKind;
  /** 表示ラベル (AA / AKs / AKo)。 */
  label: string;
}

/** 全コンボ数 = C(52,2)。 */
export const TOTAL_COMBOS = 1326;

/**
 * 13×13 マトリクスの (row, col) → ハンド。
 *   - 対角線 (row===col): ペア
 *   - 右上 (row<col): スーテッド (高ランク = RANKS[row])
 *   - 左下 (row>col): オフスート (高ランク = RANKS[col])
 * RANKS は A(0)..2(12) の降順。
 */
export function handAt(row: number, col: number): MatrixHand {
  const a = RANKS[row];
  const b = RANKS[col];
  if (row === col) return { hi: a, lo: a, kind: 'pair', label: `${a}${a}` };
  if (row < col) return { hi: a, lo: b, kind: 'suited', label: `${a}${b}s` };
  return { hi: b, lo: a, kind: 'offsuit', label: `${b}${a}o` };
}

/** 2 枚から canonical なコンボ key (cardToInt の大きい方が先頭)。 */
export function comboKeyOf(a: Card, b: Card): string {
  const sa = `${a.rank}${a.suit}`;
  const sb = `${b.rank}${b.suit}`;
  return cardToInt(a) >= cardToInt(b) ? sa + sb : sb + sa;
}

/** ハンドの全コンボ (pair 6 / suited 4 / offsuit 12)。 */
export function combosOfHand(h: MatrixHand): Array<[Card, Card]> {
  const out: Array<[Card, Card]> = [];
  if (h.kind === 'pair') {
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++)
        out.push([{ rank: h.hi, suit: SUITS[i] }, { rank: h.hi, suit: SUITS[j] }]);
  } else if (h.kind === 'suited') {
    for (const s of SUITS) out.push([{ rank: h.hi, suit: s }, { rank: h.lo, suit: s }]);
  } else {
    for (const s1 of SUITS)
      for (const s2 of SUITS)
        if (s1 !== s2) out.push([{ rank: h.hi, suit: s1 }, { rank: h.lo, suit: s2 }]);
  }
  return out;
}

/** ハンドの全コンボ key。 */
export function handKeys(h: MatrixHand): string[] {
  return combosOfHand(h).map(([a, b]) => comboKeyOf(a, b));
}

/**
 * コンボ詳細 (4×4 スートマトリクス) の (row, col) → コンボ。無効セルは null。
 *   - pair: 上三角 (row<col) の 6 セル
 *   - suited: 対角線 (row===col) の 4 セル
 *   - offsuit: 対角線以外 (row!==col) の 12 セル
 * row = 1枚目 (hi) のスート、col = 2枚目 (lo) のスート。
 */
export function comboAtSuits(h: MatrixHand, row: number, col: number): [Card, Card] | null {
  const s1 = SUITS[row];
  const s2 = SUITS[col];
  if (h.kind === 'pair') {
    if (row >= col) return null;
    return [{ rank: h.hi, suit: s1 }, { rank: h.hi, suit: s2 }];
  }
  if (h.kind === 'suited') {
    if (row !== col) return null;
    return [{ rank: h.hi, suit: s1 }, { rank: h.lo, suit: s1 }];
  }
  if (row === col) return null;
  return [{ rank: h.hi, suit: s1 }, { rank: h.lo, suit: s2 }];
}

/** 全 1326 コンボの key。 */
export function allComboKeys(): string[] {
  const out: string[] = [];
  for (let row = 0; row < 13; row++)
    for (let col = 0; col < 13; col++)
      out.push(...handKeys(handAt(row, col)));
  return out;
}

/** コンボ key → カード整数のペア。 */
export function comboKeyToInts(key: string): [number, number] {
  const a = stringToCard(key.slice(0, 2))!;
  const b = stringToCard(key.slice(2, 4))!;
  return [cardToInt(a), cardToInt(b)];
}
