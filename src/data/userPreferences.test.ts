import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadInstantFeedback, saveInstantFeedback, loadUserPreferences } from './userPreferences';

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

  it('既定は OFF (false)', () => {
    expect(loadInstantFeedback()).toBe(false);
    expect(loadUserPreferences()).toEqual({ instantFeedback: false });
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
