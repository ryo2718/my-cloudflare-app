import { describe, it, expect } from 'vitest';
import { parseMissedFilter, scoreMatchesFilter } from './missedChallengeStore';
import { positionalPillStyle } from './positionalPill';

describe('parseMissedFilter', () => {
  it('有効値はそのまま、無効は all', () => {
    expect(parseMissedFilter('partial')).toBe('partial');
    expect(parseMissedFilter('zero')).toBe('zero');
    expect(parseMissedFilter('miss')).toBe('miss');
    expect(parseMissedFilter('all')).toBe('all');
    expect(parseMissedFilter(null)).toBe('all');
    expect(parseMissedFilter('bogus')).toBe('all');
  });
});

describe('scoreMatchesFilter (◎○△× フィルター)', () => {
  it('all は常に true', () => {
    for (const s of [-1, 0, 1, 2]) expect(scoreMatchesFilter(s, 'all')).toBe(true);
  });
  it('partial=○ (1pt)', () => {
    expect(scoreMatchesFilter(1, 'partial')).toBe(true);
    expect(scoreMatchesFilter(0, 'partial')).toBe(false);
    expect(scoreMatchesFilter(-1, 'partial')).toBe(false);
  });
  it('zero=△ (0pt)', () => {
    expect(scoreMatchesFilter(0, 'zero')).toBe(true);
    expect(scoreMatchesFilter(1, 'zero')).toBe(false);
  });
  it('miss=✕ (-1pt)', () => {
    expect(scoreMatchesFilter(-1, 'miss')).toBe(true);
    expect(scoreMatchesFilter(0, 'miss')).toBe(false);
  });
});

describe('positionalPillStyle (vs5bet 黒化)', () => {
  it('vs 5bet シナリオは黒系、他はオレンジ系', () => {
    const vs5 = positionalPillStyle('ep_vs_4bet');
    const other = positionalPillStyle('sb_open');
    expect(vs5.border).toContain('#2C2C2A'); // 黒枠
    expect(vs5.color).toBe('#2C2C2A');
    expect(other.border).toContain('#E5A551'); // オレンジ枠
    expect(other.color).toBe('#993C1D');
  });
});
