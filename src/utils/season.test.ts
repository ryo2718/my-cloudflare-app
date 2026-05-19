import { describe, expect, it } from 'vitest';
import { currentSeason } from './season';

describe('currentSeason (シーズン算出)', () => {
  it('5月 → シーズン1 (id=YYYY-05)', () => {
    const s = currentSeason(new Date(2026, 4, 19)); // 5月 (0-indexed)
    expect(s.number).toBe(1);
    expect(s.id).toBe('2026-05');
    expect(s.name).toContain('シーズン1');
    expect(s.name).toContain('5-6月');
  });

  it('6月 → シーズン1 (前月始まり)', () => {
    const s = currentSeason(new Date(2026, 5, 1)); // 6月
    expect(s.number).toBe(1);
    expect(s.id).toBe('2026-05');
  });

  it('7月 → シーズン2', () => {
    const s = currentSeason(new Date(2026, 6, 15));
    expect(s.number).toBe(2);
    expect(s.id).toBe('2026-07');
  });

  it('11月 → シーズン4', () => {
    const s = currentSeason(new Date(2026, 10, 1));
    expect(s.number).toBe(4);
    expect(s.id).toBe('2026-11');
  });

  it('1月 (翌暦年) → シーズン5、 年は当該カレンダー年', () => {
    const s = currentSeason(new Date(2027, 0, 10));
    expect(s.number).toBe(5);
    expect(s.id).toBe('2027-01');
  });

  it('3月 → シーズン6', () => {
    const s = currentSeason(new Date(2026, 2, 10));
    expect(s.number).toBe(6);
    expect(s.id).toBe('2026-03');
  });

  it('4月 → シーズン6 (3月始まり)', () => {
    const s = currentSeason(new Date(2026, 3, 1));
    expect(s.number).toBe(6);
    expect(s.id).toBe('2026-03');
  });
});
