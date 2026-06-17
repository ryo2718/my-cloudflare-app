import { describe, it, expect } from 'vitest';
import {
  chainToStem,
  tokenToStem,
  parentStem,
  activePositions,
  actorPosition,
  nextActions,
  formatToken,
  chainSteps,
} from './chain';
import type { PreflopV2Index, PreflopV2Node } from './types';

function node(partial: Partial<PreflopV2Node>): PreflopV2Node {
  return {
    _meta: { preflop_actions: '', actor: 'utg' },
    game_info: {},
    actions_legend: {},
    hands: {},
    ...partial,
  };
}

describe('chainToStem / tokenToStem', () => {
  it('maps canonical chain to R2 file stem', () => {
    expect(chainToStem('')).toBe('root');
    expect(chainToStem('F-F-F')).toBe('F_F_F');
    expect(chainToStem('F-R2-R6.5')).toBe('F_R2_R6_5');
  });
  it('maps a single token to a stem fragment', () => {
    expect(tokenToStem('R13.1')).toBe('R13_1');
    expect(tokenToStem('RAI')).toBe('RAI');
    expect(tokenToStem('F')).toBe('F');
  });
});

describe('parentStem', () => {
  it('returns null for root', () => {
    expect(parentStem('')).toBeNull();
  });
  it('returns root stem for a depth-1 chain', () => {
    expect(parentStem('F')).toBe('root');
  });
  it('drops the last token', () => {
    expect(parentStem('F-R2-R6.5')).toBe('F_R2');
  });
});

describe('activePositions', () => {
  it('uses _meta.active_positions when present', () => {
    const n = node({ _meta: { preflop_actions: 'F', actor: 'hj', active_positions: ['HJ', 'BB'] } });
    expect(activePositions(n)).toEqual(['HJ', 'BB']);
  });
  it('derives from non-folded players when active_positions absent (nl50)', () => {
    const n = node({
      _meta: { preflop_actions: 'F-F', actor: 'sb' },
      game_info: {
        players: [
          { position: 'UTG', is_folded: true },
          { position: 'SB', is_folded: false },
          { position: 'BB', is_folded: false },
        ],
      },
    });
    expect(activePositions(n)).toEqual(['SB', 'BB']);
  });
});

describe('actorPosition', () => {
  it('uppercases the actor', () => {
    expect(actorPosition(node({ _meta: { preflop_actions: '', actor: 'btn' } }))).toBe('BTN');
  });
});

describe('nextActions', () => {
  const index: PreflopV2Index = {
    config: 'c',
    label: 'L',
    stackBb: 100,
    rake: 'NL500',
    openSize: 'gto',
    positionOrder: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    entries: {},
    nodes: {
      F_R2_R6_5: ['F_R2_R6_5_C', 'F_R2_R6_5_F', 'F_R2_R6_5_R13_1'],
      root: ['F', 'R2'],
    },
  };

  it('returns only legend actions that have a real child node, in legend order', () => {
    const n = node({
      _meta: { preflop_actions: 'F-R2-R6.5', actor: 'utg' },
      actions_legend: { F: 'fold (0bb)', C: 'call (6.5bb)', 'R13.1': 'raise (13.1bb)', RAI: 'all-in raise (100bb)' },
    });
    const got = nextActions(n, index);
    // RAI has no child -> excluded (terminal). Order follows legend insertion.
    expect(got.map((a) => a.token)).toEqual(['F', 'C', 'R13.1']);
    expect(got.map((a) => a.childStem)).toEqual([
      'F_R2_R6_5_F',
      'F_R2_R6_5_C',
      'F_R2_R6_5_R13_1',
    ]);
    expect(got[2].actionLabel).toBe('raise (13.1bb)');
  });

  it('builds child stems from root correctly', () => {
    const n = node({
      _meta: { preflop_actions: '', actor: 'utg' },
      actions_legend: { F: 'fold (0bb)', R2: 'raise (2bb)' },
    });
    expect(nextActions(n, index).map((a) => a.childStem)).toEqual(['F', 'R2']);
  });

  it('returns empty when no children in index (leaf)', () => {
    const n = node({
      _meta: { preflop_actions: 'X-Y', actor: 'bb' },
      actions_legend: { F: 'fold' },
    });
    expect(nextActions(n, index)).toEqual([]);
  });
});

describe('formatToken / chainSteps', () => {
  it('formats single tokens', () => {
    expect(formatToken('F')).toBe('Fold');
    expect(formatToken('C')).toBe('Call');
    expect(formatToken('X')).toBe('Check');
    expect(formatToken('RAI')).toBe('All-in');
    expect(formatToken('R6.5')).toBe('Raise 6.5bb');
    expect(formatToken('R2')).toBe('Raise 2bb');
  });
  it('splits a chain into step labels', () => {
    expect(chainSteps('')).toEqual([]);
    expect(chainSteps('F-R2-R6.5')).toEqual(['Fold', 'Raise 2bb', 'Raise 6.5bb']);
  });
});
