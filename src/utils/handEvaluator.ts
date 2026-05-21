// 7 枚 (ホール2 + ボード5) からベスト 5 枚役を評価するエバリュエーター。
// エクイティ計算で大量に呼ぶため、配列確保を避け整数スコアで高速比較する。
//
// カード表現: 整数 0..51 = rankIdx*4 + suitIdx
//   rankIdx: 0='2' .. 12='A'
//   suitIdx: 0='s', 1='h', 2='d', 3='c'

import type { Card } from '../types/card';

const RANK_CHARS = '23456789TJQKA';
const SUIT_CHARS = 'shdc';

/** Card → 整数 (0..51)。 */
export function cardToInt(card: Card): number {
  const r = RANK_CHARS.indexOf(card.rank);
  const s = SUIT_CHARS.indexOf(card.suit);
  return r * 4 + s;
}

// 役カテゴリ (大きいほど強い)。
const STRAIGHT_FLUSH = 8;
const QUADS = 7;
const FULL_HOUSE = 6;
const FLUSH = 5;
const STRAIGHT = 4;
const TRIPS = 3;
const TWO_PAIR = 2;
const PAIR = 1;
const HIGH = 0;

/** カテゴリ + 最大5つのタイブレーク (rank 0..12, 最上位から) を比較可能な整数に。 */
function mk(category: number, t0: number, t1: number, t2: number, t3: number, t4: number): number {
  // 各タイブレークは 0..12 → +1 して 1..13、無しは 0。base 15。
  return ((((category * 15 + (t0 + 1)) * 15 + (t1 + 1)) * 15 + (t2 + 1)) * 15 + (t3 + 1)) * 15 + (t4 + 1);
}

// スクラッチ (逐次呼び出しのみ・再入なしなので使い回し可)。
const rankCount = new Int8Array(13);

/** rank ビットマスクから最高ストレートの「最高位 rank」を返す。無ければ -1。A-5 (wheel) は 3 ('5') を返す。 */
function topStraight(mask: number): number {
  for (let hi = 12; hi >= 4; hi--) {
    let ok = true;
    for (let r = hi; r > hi - 5; r--) {
      if ((mask & (1 << r)) === 0) {
        ok = false;
        break;
      }
    }
    if (ok) return hi;
  }
  // wheel: A(12),5(3),4(2),3(1),2(0)
  if ((mask & (1 << 12)) && (mask & 0b1111) === 0b1111) return 3;
  return -1;
}

/**
 * 7 枚評価。各引数はカード整数 (0..51)。
 * 戻り値はスコア (大きいほど強い、同値は引き分け)。
 */
export function evaluate7(
  c0: number, c1: number, c2: number, c3: number, c4: number, c5: number, c6: number,
): number {
  rankCount.fill(0);
  const suitCount0 = [0, 0, 0, 0];
  const suitMask = [0, 0, 0, 0];
  let rankMask = 0;

  const cards = [c0, c1, c2, c3, c4, c5, c6];
  for (let i = 0; i < 7; i++) {
    const c = cards[i];
    const r = c >> 2;
    const s = c & 3;
    rankCount[r]++;
    suitCount0[s]++;
    suitMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCount0[s] >= 5) flushSuit = s;

  // ストレートフラッシュ
  if (flushSuit >= 0) {
    const sf = topStraight(suitMask[flushSuit]);
    if (sf >= 0) return mk(STRAIGHT_FLUSH, sf, 0, 0, 0, 0);
  }

  // ランクをカウント別に分類 (高い順)
  let quad = -1;
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    const cnt = rankCount[r];
    if (cnt === 4) quad = r;
    else if (cnt === 3) trips.push(r);
    else if (cnt === 2) pairs.push(r);
  }

  // クアッズ
  if (quad >= 0) {
    let k = -1;
    for (let r = 12; r >= 0; r--) if (r !== quad && rankCount[r] > 0) { k = r; break; }
    return mk(QUADS, quad, k, 0, 0, 0);
  }

  // フルハウス (トリップ + (2 つ目トリップ or ペア))
  if (trips.length > 0) {
    const t = trips[0];
    let p = -1;
    if (trips.length > 1) p = trips[1];
    if (pairs.length > 0 && pairs[0] > p) p = pairs[0];
    if (p >= 0) return mk(FULL_HOUSE, t, p, 0, 0, 0);
  }

  // フラッシュ (ストレートでない)
  if (flushSuit >= 0) {
    const m = suitMask[flushSuit];
    const top: number[] = [];
    for (let r = 12; r >= 0 && top.length < 5; r--) if (m & (1 << r)) top.push(r);
    return mk(FLUSH, top[0], top[1], top[2], top[3], top[4]);
  }

  // ストレート
  const st = topStraight(rankMask);
  if (st >= 0) return mk(STRAIGHT, st, 0, 0, 0, 0);

  // スリーカード (この時点で pairs は使われていない)
  if (trips.length > 0) {
    const t = trips[0];
    const k: number[] = [];
    for (let r = 12; r >= 0 && k.length < 2; r--) if (r !== t && rankCount[r] > 0) k.push(r);
    return mk(TRIPS, t, k[0], k[1], 0, 0);
  }

  // ツーペア
  if (pairs.length >= 2) {
    const p1 = pairs[0];
    const p2 = pairs[1];
    let k = -1;
    for (let r = 12; r >= 0; r--) if (r !== p1 && r !== p2 && rankCount[r] > 0) { k = r; break; }
    return mk(TWO_PAIR, p1, p2, k, 0, 0);
  }

  // ワンペア
  if (pairs.length === 1) {
    const p = pairs[0];
    const k: number[] = [];
    for (let r = 12; r >= 0 && k.length < 3; r--) if (r !== p && rankCount[r] > 0) k.push(r);
    return mk(PAIR, p, k[0], k[1], k[2], 0);
  }

  // ハイカード
  const top: number[] = [];
  for (let r = 12; r >= 0 && top.length < 5; r--) if (rankMask & (1 << r)) top.push(r);
  return mk(HIGH, top[0], top[1], top[2], top[3], top[4]);
}
