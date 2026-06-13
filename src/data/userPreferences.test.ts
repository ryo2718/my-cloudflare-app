import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadInstantFeedback, saveInstantFeedback, loadUserPreferences, loadStatsCategory, saveStatsCategory } from './userPreferences';

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

describe('userPreferences (即時フィードバックの永続化)', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it('既定は OFF (false) / 正答率カテゴリは preflop', () => {
    expect(loadInstantFeedback()).toBe(false);
    expect(loadUserPreferences()).toEqual({ instantFeedback: false, statsCategory: 'preflop' });
  });

  it('正答率カテゴリ: 保存した値が復元される (instantFeedback と独立)', () => {
    expect(loadStatsCategory()).toBe('preflop');
    saveStatsCategory('flop');
    expect(loadStatsCategory()).toBe('flop');
    expect(loadInstantFeedback()).toBe(false); // 他設定に影響しない
    saveStatsCategory('preflop');
    expect(loadStatsCategory()).toBe('preflop');
  });

  it('保存した値が復元される', () => {
    saveInstantFeedback(true);
    expect(loadInstantFeedback()).toBe(true);
    saveInstantFeedback(false);
    expect(loadInstantFeedback()).toBe(false);
  });

  it('壊れた JSON は既定 (false) にフォールバック', () => {
    localStorage.setItem('pokergto.user_preferences', '{not json');
    expect(loadInstantFeedback()).toBe(false);
  });
});
