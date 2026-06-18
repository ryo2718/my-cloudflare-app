import { describe, it, expect } from 'vitest';
import {
  chainToStem,
  tokenToStem,
  parentStem,
  activePositions,
  actorPosition,
  formatToken,
  chainSteps,
  countRaisesInChain,
  raiseName,
  simulateChain,
  isLimpNode,
  foldAroundStem,
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
  it('uses the is_hero/is_active player (authoritative), not the mislabeled _meta.actor', () => {
    const n = node({
      _meta: { preflop_actions: 'F-F-F-R2.5-R12', actor: 'btn' }, // _meta.actor is wrong here
      game_info: {
        players: [
          { position: 'BB', is_hero: true, is_active: true },
          { position: 'BTN' },
          { position: 'SB' },
        ],
      },
    });
    expect(actorPosition(n)).toBe('BB');
  });
  it('falls back to betting-order sim when players are absent (root -> UTG)', () => {
    expect(actorPosition(node({ _meta: { preflop_actions: '', actor: 'xx' } }))).toBe('UTG');
  });
});

describe('countRaisesInChain / raiseName', () => {
  it('counts R tokens (excluding RAI)', () => {
    expect(countRaisesInChain('')).toBe(0);
    expect(countRaisesInChain('F-F-R2.5')).toBe(1);
    expect(countRaisesInChain('F-F-R2.5-R12-RAI')).toBe(2); // RAI not counted
  });
  it('names raises open/3bet/4bet/5bet/6bet', () => {
    expect(raiseName(0)).toBe('open');
    expect(raiseName(1)).toBe('3bet');
    expect(raiseName(2)).toBe('4bet');
    expect(raiseName(3)).toBe('5bet');
    expect(raiseName(4)).toBe('6bet');
  });
});

describe('simulateChain (preflop betting order)', () => {
  it('root: UTG first to act', () => {
    expect(simulateChain('').nextToAct).toBe('UTG');
  });
  it('assigns tokens to seats in order and finds the actor (RFI)', () => {
    const r = simulateChain('F-F-F'); // UTG/HJ/CO fold -> BTN
    expect(r.actions.map((a) => a.seat)).toEqual(['UTG', 'HJ', 'CO']);
    expect(r.nextToAct).toBe('BTN');
  });
  it('squeeze: BTN opens, SB 3bets -> BB to act (not _meta.actor which is mislabeled)', () => {
    const r = simulateChain('F-F-F-R2.5-R12');
    expect(r.actions.map((a) => `${a.seat}:${a.kind}`)).toEqual([
      'UTG:fold',
      'HJ:fold',
      'CO:fold',
      'BTN:raise',
      'SB:raise',
    ]);
    expect(r.actions[3].raiseLabel).toBe('open');
    expect(r.actions[4].raiseLabel).toBe('3bet');
    expect(r.nextToAct).toBe('BB');
  });
  it('limp: folded to SB who completes', () => {
    const r = simulateChain('F-F-F-F-C');
    expect(r.actions[4]).toMatchObject({ seat: 'SB', kind: 'limp' });
    expect(r.nextToAct).toBe('BB');
  });
});

describe('isLimpNode', () => {
  it('true when no raise yet and call available', () => {
    const n = node({
      _meta: { preflop_actions: 'F-F-F-F', actor: 'sb' },
      actions_legend: { F: 'fold', C: 'call (1bb)', 'R2': 'raise' },
    });
    expect(isLimpNode(n)).toBe(true);
  });
  it('false when a raise already happened', () => {
    const n = node({
      _meta: { preflop_actions: 'F-F-R2.5', actor: 'btn' },
      actions_legend: { F: 'fold', C: 'call (2.5bb)', 'R7': 'raise' },
    });
    expect(isLimpNode(n)).toBe(false);
  });
});

describe('foldAroundStem', () => {
  const index: PreflopV2Index = {
    config: 'c', label: 'L', stackBb: 100, rake: 'NL500', openSize: 'gto',
    positionOrder: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    entries: {},
    nodes: { root: {}, F: {}, F_F: {}, F_F_F: {} },
  };
  it('from root, fold-around to CO yields F_F (exists in index)', () => {
    expect(foldAroundStem('', 'CO', index)).toBe('F_F');
  });
  it('returns null when the fold-around node is not in the index', () => {
    expect(foldAroundStem('', 'BB', index)).toBeNull();
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
