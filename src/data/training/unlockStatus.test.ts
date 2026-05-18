import { describe, expect, it } from 'vitest';
import {
  ADVANCED_UNLOCK_THRESHOLD,
  INTERMEDIATE_UNLOCK_THRESHOLD,
  computeUnlockStatus,
  isLevelUnlocked,
  lockHintFor,
} from './unlockStatus';
import type { TrainingResult } from '../../api/account';

function rec(type: string, best: number): TrainingResult {
  return {
    id: 1,
    account_id: 1,
    training_type: type,
    best_score: best,
    best_score_at: Date.now(),
    total_attempts: 1,
    updated_at: Date.now(),
  };
}

describe('computeUnlockStatus (アンロック判定)', () => {
  it('レコードなし: 初級のみアンロック、中級・上級・超上級はロック', () => {
    const s = computeUnlockStatus([]);
    expect(s.beginnerUnlocked).toBe(true);
    expect(s.intermediateUnlocked).toBe(false);
    expect(s.advancedUnlocked).toBe(false);
    expect(s.superAdvancedUnlocked).toBe(false);
  });

  it('初級 19/20 (未満) → 中級ロック', () => {
    const s = computeUnlockStatus([rec('preflop_beginner', 19)]);
    expect(s.intermediateUnlocked).toBe(false);
  });

  it('初級 20/20 (達成) → 中級アンロック', () => {
    const s = computeUnlockStatus([rec('preflop_beginner', 20)]);
    expect(s.intermediateUnlocked).toBe(true);
  });

  it('中級 0pt → 上級ロック', () => {
    const s = computeUnlockStatus([
      rec('preflop_beginner', 20),
      rec('preflop_intermediate', 0),
    ]);
    expect(s.advancedUnlocked).toBe(false);
  });

  it('中級 19pt (未満) → 上級ロック', () => {
    const s = computeUnlockStatus([
      rec('preflop_beginner', 20),
      rec('preflop_intermediate', 19),
    ]);
    expect(s.advancedUnlocked).toBe(false);
  });

  it('中級 20pt (達成) → 上級アンロック', () => {
    const s = computeUnlockStatus([
      rec('preflop_beginner', 20),
      rec('preflop_intermediate', 20),
    ]);
    expect(s.advancedUnlocked).toBe(true);
  });

  it('中級 40pt (満点) → 上級アンロック', () => {
    const s = computeUnlockStatus([
      rec('preflop_beginner', 20),
      rec('preflop_intermediate', 40),
    ]);
    expect(s.advancedUnlocked).toBe(true);
  });

  it('超上級は常にロック (未実装)', () => {
    const s = computeUnlockStatus([
      rec('preflop_beginner', 20),
      rec('preflop_intermediate', 40),
    ]);
    expect(s.superAdvancedUnlocked).toBe(false);
  });

  it('閾値定数の確認', () => {
    expect(INTERMEDIATE_UNLOCK_THRESHOLD).toBe(20);
    expect(ADVANCED_UNLOCK_THRESHOLD).toBe(20);
  });
});

describe('isLevelUnlocked (level.key → ロック判定)', () => {
  const allLocked = {
    beginnerUnlocked: true,
    intermediateUnlocked: false,
    advancedUnlocked: false,
    superAdvancedUnlocked: false,
  };
  const allUnlocked = {
    beginnerUnlocked: true,
    intermediateUnlocked: true,
    advancedUnlocked: true,
    superAdvancedUnlocked: false, // 超上級は常に false
  };

  it('preflop_beginner: 常にアンロック', () => {
    expect(isLevelUnlocked('preflop_beginner', allLocked)).toBe(true);
  });
  it('preflop_intermediate: status に従う', () => {
    expect(isLevelUnlocked('preflop_intermediate', allLocked)).toBe(false);
    expect(isLevelUnlocked('preflop_intermediate', allUnlocked)).toBe(true);
  });
  it('preflop_advanced: status に従う', () => {
    expect(isLevelUnlocked('preflop_advanced', allLocked)).toBe(false);
    expect(isLevelUnlocked('preflop_advanced', allUnlocked)).toBe(true);
  });
  it('preflop_expert: 常にロック', () => {
    expect(isLevelUnlocked('preflop_expert', allUnlocked)).toBe(false);
  });
  it('flop_*: 全てロック (未実装)', () => {
    expect(isLevelUnlocked('flop_beginner', allUnlocked)).toBe(false);
    expect(isLevelUnlocked('flop_intermediate', allUnlocked)).toBe(false);
  });
});

describe('lockHintFor (ロック中ヒント文)', () => {
  it('中級: "初級で 20/20 取るとアンロック"', () => {
    expect(lockHintFor('preflop_intermediate')).toBe('初級で 20/20 取るとアンロック');
  });
  it('上級: "中級で 20pt 取るとアンロック"', () => {
    expect(lockHintFor('preflop_advanced')).toBe('中級で 20pt 取るとアンロック');
  });
  it('超上級: "未実装"', () => {
    expect(lockHintFor('preflop_expert')).toBe('未実装');
  });
  it('初級: null', () => {
    expect(lockHintFor('preflop_beginner')).toBeNull();
  });
});
