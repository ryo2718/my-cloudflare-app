import { describe, it, expect } from 'vitest';
import { isoSignature, parseBoardName } from './flopBoardCanonical';
import type { Card } from '../types/card';

function flop(s: string): [Card, Card, Card] {
  return parseBoardName(s);
}

describe('parseBoardName', () => {
  it('parses 6-char board names', () => {
    expect(parseBoardName('2h2d2c')).toEqual([
      { rank: '2', suit: 'h' },
      { rank: '2', suit: 'd' },
      { rank: '2', suit: 'c' },
    ]);
  });

  it('parses with spades / mixed', () => {
    expect(parseBoardName('AsKhQd')).toEqual([
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 'h' },
      { rank: 'Q', suit: 'd' },
    ]);
  });

  it('handles T/J/Q/K/A ranks', () => {
    expect(parseBoardName('TsJsQs')).toEqual([
      { rank: 'T', suit: 's' },
      { rank: 'J', suit: 's' },
      { rank: 'Q', suit: 's' },
    ]);
  });

  it('throws on wrong length', () => {
    expect(() => parseBoardName('2h2d')).toThrow();
    expect(() => parseBoardName('2h2d2c2s')).toThrow();
  });

  it('throws on invalid rank/suit', () => {
    expect(() => parseBoardName('Xh2d2c')).toThrow();
    expect(() => parseBoardName('2z2d2c')).toThrow();
  });

  it('throws on duplicate cards', () => {
    expect(() => parseBoardName('2h2d2h')).toThrow(); // 2h twice
  });
});

describe('isoSignature — same iso class produces same signature', () => {
  it('monotone (all same suit): all 4 spade-permutations match', () => {
    const sig = isoSignature(flop('AhKhQh'));
    expect(isoSignature(flop('AsKsQs'))).toBe(sig);
    expect(isoSignature(flop('AdKdQd'))).toBe(sig);
    expect(isoSignature(flop('AcKcQc'))).toBe(sig);
  });

  it('rainbow distinct ranks: all suit-orderings match', () => {
    const sig = isoSignature(flop('AsKhQd'));
    expect(isoSignature(flop('AhKdQc'))).toBe(sig);
    expect(isoSignature(flop('AdKcQs'))).toBe(sig);
    expect(isoSignature(flop('AcKsQh'))).toBe(sig);
    // 入力順 scramble (parseBoardName は順序維持、isoSignature 内部でソート):
    expect(
      isoSignature([
        { rank: 'Q', suit: 's' },
        { rank: 'K', suit: 'h' },
        { rank: 'A', suit: 'd' },
      ]),
    ).toBe(sig);
  });

  it('two-tone (pos 0,1 share): pair-suit + kicker-distinct', () => {
    // KsKh5d ⇄ KhKs5d ⇄ KdKc5h (any A,A,B suit pattern with these ranks)
    const sig = isoSignature(flop('KsKh5d'));
    expect(isoSignature(flop('KhKs5d'))).toBe(sig); // pair swap
    expect(isoSignature(flop('KdKc5h'))).toBe(sig); // re-suit
    expect(isoSignature(flop('KhKc5s'))).toBe(sig);
  });

  it('two-tone (pair shares with kicker): K,K,5 where 5 matches one K suit', () => {
    // KhKd5h: kicker shares with first K's suit
    // KhKd5d: kicker shares with second K's suit
    // These are iso-equivalent (suit-swap h↔d turns one into the other after pair reorder)
    const sig1 = isoSignature(flop('KhKd5h'));
    const sig2 = isoSignature(flop('KhKd5d'));
    expect(sig1).toBe(sig2);
  });

  it('rainbow paired ranks: 3d3c2h ⇄ 3h3d2c', () => {
    // Both are KK2-style rainbow (no suits shared anywhere)
    expect(isoSignature(flop('3d3c2h'))).toBe(isoSignature(flop('3h3d2c')));
    expect(isoSignature(flop('3h3d2c'))).toBe(isoSignature(flop('3s3c2d')));
  });

  it('trip rainbow: all 6 suit-permutations of 2,2,2 match', () => {
    const sig = isoSignature(flop('2h2d2c'));
    expect(isoSignature(flop('2h2c2d'))).toBe(sig);
    expect(isoSignature(flop('2d2h2c'))).toBe(sig);
    expect(isoSignature(flop('2d2c2h'))).toBe(sig);
    expect(isoSignature(flop('2c2h2d'))).toBe(sig);
    expect(isoSignature(flop('2c2d2h'))).toBe(sig);
    // Trips with spades
    expect(isoSignature(flop('2s2h2d'))).toBe(sig);
  });

  it('handles all-paired (33,3) rainbow: 3h3d3c invariant under suit perm', () => {
    const sig = isoSignature(flop('3h3d3c'));
    expect(isoSignature(flop('3d3h3c'))).toBe(sig);
    expect(isoSignature(flop('3c3h3d'))).toBe(sig);
  });
});

describe('isoSignature — different iso classes produce different signatures', () => {
  it('different rank multisets', () => {
    expect(isoSignature(flop('AhKhQh'))).not.toBe(isoSignature(flop('AhKhJh')));
    expect(isoSignature(flop('AhKhQh'))).not.toBe(isoSignature(flop('AhKhQd')));
  });

  it('monotone vs two-tone vs rainbow (same ranks)', () => {
    const mono = isoSignature(flop('AhKhQh'));
    const twoToneTop = isoSignature(flop('AhKhQd')); // pos 0,1 share
    const twoToneSplit = isoSignature(flop('AhKdQh')); // pos 0,2 share
    const rainbow = isoSignature(flop('AhKdQc'));
    expect(mono).not.toBe(twoToneTop);
    expect(mono).not.toBe(rainbow);
    expect(twoToneTop).not.toBe(rainbow);
    expect(twoToneSplit).not.toBe(twoToneTop);
  });

  it('pair-on-top vs pair-on-bottom (KK5 vs K55)', () => {
    expect(isoSignature(flop('KhKd5c'))).not.toBe(isoSignature(flop('Kh5d5c')));
  });
});

describe('isoSignature — output format', () => {
  it('signature has ranks then "|" then class labels', () => {
    const sig = isoSignature(flop('AhKdQc'));
    expect(sig).toMatch(/^[2-9TJQKA]{3}\|[A-C]{3}$/);
  });

  it('rank portion is descending', () => {
    const sig = isoSignature(flop('2h7d5c')); // input scrambled
    expect(sig.startsWith('752|')).toBe(true);
  });

  it('class portion starts with "A"', () => {
    const sig = isoSignature(flop('AsKhQd'));
    expect(sig.split('|')[1].startsWith('A')).toBe(true);
  });

  it('throws on duplicate cards', () => {
    const dup: [Card, Card, Card] = [
      { rank: 'A', suit: 's' },
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 'h' },
    ];
    expect(() => isoSignature(dup)).toThrow();
  });
});

describe('isoSignature — invariant under input order permutation', () => {
  it('input scramble yields same signature (rainbow)', () => {
    const sig = isoSignature(flop('AsKhQd'));
    const scrambled: [Card, Card, Card] = [
      { rank: 'Q', suit: 'd' },
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 'h' },
    ];
    expect(isoSignature(scrambled)).toBe(sig);
  });

  it('input scramble yields same signature (paired)', () => {
    const sig = isoSignature(flop('KhKd5c'));
    const scrambled: [Card, Card, Card] = [
      { rank: '5', suit: 'c' },
      { rank: 'K', suit: 'd' },
      { rank: 'K', suit: 'h' },
    ];
    expect(isoSignature(scrambled)).toBe(sig);
  });
});
