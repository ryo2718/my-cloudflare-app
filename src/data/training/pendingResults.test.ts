// @vitest-environment jsdom
// pendingResults: 退避 / 取得 / 破棄 / 重複置き換え。

import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePendingResult,
  loadPendingResults,
  clearPendingResult,
  __clearAllPendingResults,
} from './pendingResults';

beforeEach(() => {
  __clearAllPendingResults();
});

describe('pendingResults', () => {
  it('save → load で退避が取得できる', () => {
    savePendingResult({ training_type: 'preflop_intermediate_lp', score: 18 });
    const list = loadPendingResults();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ training_type: 'preflop_intermediate_lp', score: 18 });
    expect(typeof list[0].savedAt).toBe('number');
  });

  it('同 training_type は最新スコアで置き換え (重複退避しない)', () => {
    savePendingResult({ training_type: 'preflop_beginner', score: 10 });
    savePendingResult({ training_type: 'preflop_beginner', score: 14 });
    const list = loadPendingResults();
    expect(list).toHaveLength(1);
    expect(list[0].score).toBe(14);
  });

  it('異なる training_type は併存する', () => {
    savePendingResult({ training_type: 'preflop_beginner', score: 10 });
    savePendingResult({ training_type: 'preflop_intermediate', score: 30 });
    expect(loadPendingResults()).toHaveLength(2);
  });

  it('clear で該当 training_type のみ破棄', () => {
    savePendingResult({ training_type: 'preflop_beginner', score: 10 });
    savePendingResult({ training_type: 'preflop_intermediate', score: 30 });
    clearPendingResult('preflop_beginner');
    const list = loadPendingResults();
    expect(list).toHaveLength(1);
    expect(list[0].training_type).toBe('preflop_intermediate');
  });
});
