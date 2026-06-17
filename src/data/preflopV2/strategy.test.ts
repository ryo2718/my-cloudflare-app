import { describe, it, expect } from 'vitest';
import { nodeToStrategy, PREFLOP_V2_ACTIONS } from './strategy';
import type { PreflopV2Node } from './types';

describe('PREFLOP_V2_ACTIONS', () => {
  it('matches the HandMatrix contract: [fold, call, raise, allin]', () => {
    expect(PREFLOP_V2_ACTIONS.map((a) => a.id)).toEqual(['fold', 'call', 'raise', 'allin']);
    // colors identical to utils/normalize.ts FIXED_ACTIONS
    expect(PREFLOP_V2_ACTIONS.map((a) => a.color)).toEqual([
      '#0284c7',
      '#16a34a',
      '#ef4444',
      '#9333ea',
    ]);
  });
});

describe('nodeToStrategy', () => {
  const node: PreflopV2Node = {
    _meta: { preflop_actions: 'F-R2-R6.5', actor: 'utg' },
    game_info: {},
    actions_legend: {},
    hands: {
      AA: { allin: 0, raise: 100, call: 0, fold: 0, range_weight: 1 },
      AKs: { allin: 27, raise: 62, call: 11, fold: 0, range_weight: 1 },
      '72o': { allin: 0, raise: 0, call: 0, fold: 100, range_weight: 0 },
    },
  };

  it('converts 0-100 {allin,raise,call,fold} to 0-1 [fold,call,raise,allin]', () => {
    const s = nodeToStrategy(node) as Record<string, number[]>;
    expect(s.AA).toEqual([0, 0, 1, 0]);
    expect(s.AKs).toEqual([0, 0.11, 0.62, 0.27]);
    expect(s['72o']).toEqual([1, 0, 0, 0]);
  });

  it('keeps every hand key (sparse handling is downstream)', () => {
    const s = nodeToStrategy(node) as Record<string, number[]>;
    expect(Object.keys(s).sort()).toEqual(['72o', 'AA', 'AKs']);
  });
});
