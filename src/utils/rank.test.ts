import { describe, expect, it } from 'vitest';
import { calculateRank } from './rank';

const SHRIMP = ['shrimp_1', 'shrimp_2', 'shrimp_3'];
const FISH_ALL = [
  'fish_pf_open',
  'fish_pf_vs_open',
  'fish_pf_vs_3bet_4bet',
  'fish_flop_beginner',
  'fish_pf_intermediate',
  'fish_pf_ep',
  'fish_pf_lp',
  'fish_pf_blind',
  'fish_flop_cb_srp',
  'fish_flop_cb_3bp',
  'fish_flop_donk',
];

describe('calculateRank (実績 ID → ランク)', () => {
  it('全実績未達成 → ランクなし', () => {
    const r = calculateRank([]);
    expect(r.tier).toBeNull();
    expect(r.label).toBe('ランクなし');
    expect(r.image).toBeNull();
  });

  it('ビギナー部分達成 → ランクなし (1 つでも未達)', () => {
    expect(calculateRank(['shrimp_1', 'shrimp_2']).tier).toBeNull();
  });

  it('ビギナー全達成 → ビギナーランク (しきい値変更の影響を受けない)', () => {
    const r = calculateRank(SHRIMP);
    expect(r.tier).toBe('shrimp');
    expect(r.label).toBe('ビギナー');
    expect(r.image).not.toBeNull();
  });

  it('ビギナー全 + スタンダード 7 個 → ビギナーで止まる (8 個未満)', () => {
    const r = calculateRank([...SHRIMP, ...FISH_ALL.slice(0, 7)]);
    expect(r.tier).toBe('shrimp');
  });

  it('ビギナー全 + スタンダード 8 個 → スタンダードランク (8/11 で到達)', () => {
    const r = calculateRank([...SHRIMP, ...FISH_ALL.slice(0, 8)]);
    expect(r.tier).toBe('fish');
    expect(r.label).toBe('スタンダード');
  });

  it('ビギナー全 + スタンダード 11 個全部 → スタンダードランク', () => {
    expect(calculateRank([...SHRIMP, ...FISH_ALL]).tier).toBe('fish');
  });

  it('スタンダード 8 個だけ (ビギナー未達) → ランクなし (下位 tier 必須)', () => {
    expect(calculateRank(FISH_ALL.slice(0, 8)).tier).toBeNull();
  });

  it('プロ (shark) 実績は達成してもランクには影響しない (最高はスタンダード)', () => {
    const r = calculateRank([
      ...SHRIMP,
      ...FISH_ALL,
      'shark_pf_intermediate',
      'shark_flop_cb_srp',
    ]);
    expect(r.tier).toBe('fish');
  });
});
