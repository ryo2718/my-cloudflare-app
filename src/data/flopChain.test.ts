import { describe, it, expect } from 'vitest';
import {
  chainToFilename,
  filenameToChain,
  encodeStep,
  hasAggressionInChain,
} from './flopChain';

describe('chainToFilename', () => {
  it('empty chain → flop_root.json', () => {
    expect(chainToFilename('utgr_bbc', [])).toBe('flop_root.json');
  });

  it('single step', () => {
    expect(chainToFilename('utgr_bbc', ['bb_b1_8'])).toBe('flop_bb_b1_8.json');
    expect(chainToFilename('utgr_bbc', ['bb_x'])).toBe('flop_bb_x.json');
  });

  it('multi step', () => {
    expect(chainToFilename('utgr_bbc', ['bb_x', 'utg_b1_8'])).toBe(
      'flop_bb_x_utg_b1_8.json',
    );
    expect(chainToFilename('utgr_bbc', ['bb_b1_8', 'utg_r6_35'])).toBe(
      'flop_bb_b1_8_utg_r6_35.json',
    );
  });

  it('all-in tokens preserved', () => {
    expect(chainToFilename('utgr_bbc', ['bb_b1_8', 'utg_rAI'])).toBe(
      'flop_bb_b1_8_utg_rAI.json',
    );
    expect(chainToFilename('utgr_bbc', ['bb_bAI'])).toBe('flop_bb_bAI.json');
  });

  it('variant param is currently ignored (reserved for future)', () => {
    expect(chainToFilename('any-variant', ['bb_x'])).toBe('flop_bb_x.json');
  });
});

describe('filenameToChain', () => {
  it('flop_root.json → empty chain', () => {
    expect(filenameToChain('flop_root.json')).toEqual([]);
  });

  it('single step filename', () => {
    expect(filenameToChain('flop_bb_b1_8.json')).toEqual(['bb_b1_8']);
    expect(filenameToChain('flop_bb_x.json')).toEqual(['bb_x']);
  });

  it('multi step filename', () => {
    expect(filenameToChain('flop_bb_x_utg_b1_8.json')).toEqual(['bb_x', 'utg_b1_8']);
    expect(filenameToChain('flop_bb_b1_8_utg_r6_35.json')).toEqual([
      'bb_b1_8',
      'utg_r6_35',
    ]);
  });

  it('all-in tokens preserved', () => {
    expect(filenameToChain('flop_bb_b1_8_utg_rAI.json')).toEqual([
      'bb_b1_8',
      'utg_rAI',
    ]);
  });

  it('deep chains (5 levels)', () => {
    expect(filenameToChain('flop_bb_b1_8_utg_r6_35_bb_r15_45_utg_rAI.json')).toEqual([
      'bb_b1_8',
      'utg_r6_35',
      'bb_r15_45',
      'utg_rAI',
    ]);
  });

  it('throws on invalid filenames', () => {
    expect(() => filenameToChain('foo.json')).toThrow();
    expect(() => filenameToChain('flop_bb_x.txt')).toThrow();
  });
});

describe('round-trip chain ↔ filename', () => {
  const cases: string[][] = [
    [],
    ['bb_x'],
    ['bb_b1_8'],
    ['bb_x', 'utg_b1_8'],
    ['bb_b1_8', 'utg_r6_35'],
    ['bb_b1_8', 'utg_rAI'],
    ['bb_bAI'],
    ['bb_b1_8', 'utg_r6_35', 'bb_r15_45', 'utg_rAI'],
  ];

  it.each(cases.map((c) => [c]))('preserves chain %p', (chain) => {
    const filename = chainToFilename('any', chain);
    expect(filenameToChain(filename)).toEqual(chain);
  });
});

describe('encodeStep', () => {
  it('check', () => {
    expect(encodeStep('bb', 'X', false)).toBe('bb_x');
  });

  it('call', () => {
    expect(encodeStep('utg', 'C', true)).toBe('utg_c');
  });

  it('fold', () => {
    expect(encodeStep('btn', 'F', true)).toBe('btn_f');
  });

  it('first aggression: R<size> → b<size> with "." → "_"', () => {
    expect(encodeStep('bb', 'R1.8', false)).toBe('bb_b1_8');
    expect(encodeStep('utg', 'R6.35', false)).toBe('utg_b6_35');
  });

  it('re-aggression: R<size> → r<size>', () => {
    expect(encodeStep('utg', 'R6.35', true)).toBe('utg_r6_35');
    expect(encodeStep('bb', 'R15.45', true)).toBe('bb_r15_45');
  });

  it('first aggression all-in: RAI → bAI', () => {
    expect(encodeStep('bb', 'RAI', false)).toBe('bb_bAI');
  });

  it('re-aggression all-in: RAI → rAI', () => {
    expect(encodeStep('utg', 'RAI', true)).toBe('utg_rAI');
  });

  it('integer-sized raises (no decimal)', () => {
    expect(encodeStep('bb', 'R10', false)).toBe('bb_b10');
    expect(encodeStep('utg', 'R20', true)).toBe('utg_r20');
  });

  it('throws on unknown action codes', () => {
    expect(() => encodeStep('bb', 'Z', false)).toThrow();
    expect(() => encodeStep('bb', '', false)).toThrow();
  });
});

describe('hasAggressionInChain', () => {
  it('returns false for empty chain', () => {
    expect(hasAggressionInChain([])).toBe(false);
  });

  it('returns false for chain with only x/c/f', () => {
    expect(hasAggressionInChain(['bb_x'])).toBe(false);
    expect(hasAggressionInChain(['bb_x', 'utg_x'])).toBe(false);
    expect(hasAggressionInChain(['bb_x', 'utg_c'])).toBe(false);
    expect(hasAggressionInChain(['bb_f'])).toBe(false);
  });

  it('returns true if any step has b-prefix (first aggressive)', () => {
    expect(hasAggressionInChain(['bb_b1_8'])).toBe(true);
    expect(hasAggressionInChain(['bb_x', 'utg_b1_8'])).toBe(true);
    expect(hasAggressionInChain(['bb_bAI'])).toBe(true);
  });

  it('returns true if any step has r-prefix (re-aggressive)', () => {
    expect(hasAggressionInChain(['bb_b1_8', 'utg_r6_35'])).toBe(true);
    expect(hasAggressionInChain(['bb_b1_8', 'utg_rAI'])).toBe(true);
  });

  it('preserves true once introduced (next step does not undo)', () => {
    expect(hasAggressionInChain(['bb_b1_8', 'utg_c'])).toBe(true);
  });
});
