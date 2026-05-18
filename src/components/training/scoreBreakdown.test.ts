import { describe, expect, it } from 'vitest';
import { breakdownPct, computeScoreBreakdown } from './scoreBreakdown';
import type { IntermediateRecord } from '../../data/training/recordsStore';

function rec(finalScore: number): IntermediateRecord {
  return {
    id: 0,
    scenarioType: 'bb_response',
    myPosition: 'BB',
    opener: 'UTG',
    foldedBefore: [],
    hand: 'AA',
    cards: [{ rank: 'A', suit: 's' }, { rank: 'A', suit: 'h' }],
    strategy: { allin: 0, raise: 100, call: 0, fold: 0 },
    selections: [],
    timedOut: false,
    rawScore: finalScore,
    finalScore,
    theoreticalMax: 2,
    strategySnapshot: { allin: 0, raise: 100, call: 0, fold: 0 },
  };
}

describe('computeScoreBreakdown', () => {
  it('5問満点 / 11問部分点 / 4問ミス → 5/11/0/4', () => {
    const records = [
      ...Array.from({ length: 5 }, () => rec(2)),
      ...Array.from({ length: 11 }, () => rec(1)),
      ...Array.from({ length: 4 }, () => rec(-1)),
    ];
    const b = computeScoreBreakdown(records);
    expect(b).toEqual({ perfect: 5, partial: 11, zero: 0, miss: 4, total: 20 });
  });

  it('全問満点 → perfect=20', () => {
    const records = Array.from({ length: 20 }, () => rec(2));
    const b = computeScoreBreakdown(records);
    expect(b.perfect).toBe(20);
    expect(b.partial).toBe(0);
    expect(b.zero).toBe(0);
    expect(b.miss).toBe(0);
  });

  it('全問ミス → miss=20', () => {
    const records = Array.from({ length: 20 }, () => rec(-1));
    const b = computeScoreBreakdown(records);
    expect(b.miss).toBe(20);
  });

  it('finalScore=3 (理論上ない) も perfect 扱い', () => {
    expect(computeScoreBreakdown([rec(3)])).toEqual(
      { perfect: 1, partial: 0, zero: 0, miss: 0, total: 1 },
    );
  });

  it('空配列 → 全 0', () => {
    expect(computeScoreBreakdown([])).toEqual(
      { perfect: 0, partial: 0, zero: 0, miss: 0, total: 0 },
    );
  });
});

describe('breakdownPct', () => {
  it('5/20 → 25', () => expect(breakdownPct(5, 20)).toBe(25));
  it('11/20 ≈ 55 (浮動小数誤差許容)', () => expect(breakdownPct(11, 20)).toBeCloseTo(55, 5));
  it('0/20 → 0', () => expect(breakdownPct(0, 20)).toBe(0));
  it('total=0 → 0 (ゼロ除算回避)', () => expect(breakdownPct(5, 0)).toBe(0));
});
