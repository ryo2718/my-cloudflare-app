import { describe, it, expect } from 'vitest';
import { evaluate7, cardToInt } from './handEvaluator';
import { stringToCard } from '../types/card';

function ev(cards: string[]): number {
  const ints = cards.map((s) => {
    const c = stringToCard(s);
    if (!c) throw new Error(`bad card ${s}`);
    return cardToInt(c);
  });
  return evaluate7(ints[0], ints[1], ints[2], ints[3], ints[4], ints[5], ints[6]);
}

describe('evaluate7 役の強さ順', () => {
  it('役カテゴリの大小: SF > 4K > FH > Flush > Straight > 3K > 2P > 1P > High', () => {
    const sf = ev(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d']); // ロイヤル
    const quads = ev(['As', 'Ah', 'Ad', 'Ac', 'Kh', '2c', '3d']);
    const fh = ev(['As', 'Ah', 'Ad', 'Kc', 'Kh', '2c', '3d']);
    const flush = ev(['Ah', 'Jh', '9h', '6h', '3h', 'Kc', '2d']);
    const straight = ev(['9c', '8h', '7d', '6s', '5h', 'Ac', 'Kd']);
    const trips = ev(['As', 'Ah', 'Ad', 'Kc', 'Qh', '2c', '3d']);
    const twoPair = ev(['As', 'Ah', 'Kd', 'Kc', 'Qh', '2c', '3d']);
    const pair = ev(['As', 'Ah', 'Kd', 'Qc', 'Jh', '2c', '3d']);
    const high = ev(['As', 'Kh', 'Qd', 'Jc', '9h', '2c', '3d']);
    expect(sf).toBeGreaterThan(quads);
    expect(quads).toBeGreaterThan(fh);
    expect(fh).toBeGreaterThan(flush);
    expect(flush).toBeGreaterThan(straight);
    expect(straight).toBeGreaterThan(trips);
    expect(trips).toBeGreaterThan(twoPair);
    expect(twoPair).toBeGreaterThan(pair);
    expect(pair).toBeGreaterThan(high);
  });

  it('A-5 ホイールストレートを認識し、6 ハイより弱い', () => {
    const wheel = ev(['As', '2h', '3d', '4c', '5h', 'Kc', 'Qd']);
    const sixHigh = ev(['2s', '3h', '4d', '5c', '6h', 'Kc', 'Qd']);
    const noStraight = ev(['As', 'Kh', 'Qd', 'Jc', '9h', '2c', '4d']);
    expect(wheel).toBeGreaterThan(noStraight);
    expect(sixHigh).toBeGreaterThan(wheel);
  });

  it('クアッズのキッカー比較', () => {
    const quadsK = ev(['As', 'Ah', 'Ad', 'Ac', 'Kh', '2c', '3d']);
    const quadsQ = ev(['As', 'Ah', 'Ad', 'Ac', 'Qh', '2c', '3d']);
    expect(quadsK).toBeGreaterThan(quadsQ);
  });

  it('同じ役は同点 (引き分け)', () => {
    // 両者ボード共有でボードがベストの場合など同点
    const x = ev(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d']);
    const y = ev(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '4c', '5d']);
    expect(x).toBe(y);
  });

  it('フラッシュ同士はトップ5で比較', () => {
    const aHigh = ev(['Ah', 'Qh', '9h', '6h', '3h', '2c', '2d']);
    const kHigh = ev(['Kh', 'Qh', '9h', '6h', '3h', '2c', '2d']);
    expect(aHigh).toBeGreaterThan(kHigh);
  });
});
