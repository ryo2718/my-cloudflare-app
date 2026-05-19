import { describe, expect, it } from 'vitest';
import { calculateRank } from './rank';

describe('calculateRank (実績 ID → ランク)', () => {
  it('全実績未達成 → ランクなし', () => {
    const r = calculateRank([]);
    expect(r.tier).toBeNull();
    expect(r.label).toBe('ランクなし');
    expect(r.image).toBeNull();
  });

  it('ビギナー部分達成 → ランクなし (1 つでも未達)', () => {
    const r = calculateRank(['shrimp_1', 'shrimp_2']);
    expect(r.tier).toBeNull();
  });

  it('ビギナー全達成 → ビギナーランク', () => {
    const r = calculateRank(['shrimp_1', 'shrimp_2', 'shrimp_3']);
    expect(r.tier).toBe('shrimp');
    expect(r.label).toBe('ビギナー');
    expect(r.image).not.toBeNull();
  });

  it('ビギナー全 + スタンダード部分 → ビギナーで止まる', () => {
    const r = calculateRank(['shrimp_1', 'shrimp_2', 'shrimp_3', 'fish_1']);
    expect(r.tier).toBe('shrimp');
  });

  it('ビギナー全 + スタンダード全 → スタンダードランク', () => {
    const r = calculateRank([
      'shrimp_1',
      'shrimp_2',
      'shrimp_3',
      'fish_1',
      'fish_2',
    ]);
    expect(r.tier).toBe('fish');
    expect(r.label).toBe('スタンダード');
  });

  it('スタンダードだけ達成 (ビギナー未達) → ランクなし (下位 tier 全達成が前提)', () => {
    const r = calculateRank(['fish_1', 'fish_2']);
    expect(r.tier).toBeNull();
  });

  it('未実装 tier の id (shark_*) は無視される (スタンダードまで到達)', () => {
    const r = calculateRank([
      'shrimp_1',
      'shrimp_2',
      'shrimp_3',
      'fish_1',
      'fish_2',
      'shark_1', // 未実装の id があってもエラーにならず、 ランク判定にも影響しない
    ]);
    expect(r.tier).toBe('fish');
  });
});
