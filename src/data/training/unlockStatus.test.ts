import { describe, expect, it } from 'vitest';
import {
  ADVANCED_UNLOCK_THRESHOLD,
  INTERMEDIATE_UNLOCK_THRESHOLD,
  FLOP_INTERMEDIATE_UNLOCK_THRESHOLD,
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
    season_score: 0,
    season_id: '2026-05',
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

  it('初級基礎のみ 20/20 (拡張モード未クリア) → 中級ロック', () => {
    const s = computeUnlockStatus([rec('preflop_beginner', 20)]);
    expect(s.intermediateUnlocked).toBe(false);
  });

  it('プリフロップ初級 4 モード全部クリア → 中級アンロック', () => {
    const s = computeUnlockStatus([
      rec('preflop_beginner', 20),
      rec('preflop_beginner_open', 18),
      rec('preflop_beginner_vs_open', 18),
      rec('preflop_beginner_vs_3bet_4bet', 18),
    ]);
    expect(s.intermediateUnlocked).toBe(true);
  });

  it('拡張1モードが 17/20 (90%未満) → 中級ロック (境界値)', () => {
    const s = computeUnlockStatus([
      rec('preflop_beginner', 20),
      rec('preflop_beginner_open', 17),
      rec('preflop_beginner_vs_open', 18),
      rec('preflop_beginner_vs_3bet_4bet', 18),
    ]);
    expect(s.intermediateUnlocked).toBe(false);
  });

  it('基礎が 19/20 (100%未満) → 中級ロック (基礎は満点必須)', () => {
    const s = computeUnlockStatus([
      rec('preflop_beginner', 19),
      rec('preflop_beginner_open', 18),
      rec('preflop_beginner_vs_open', 18),
      rec('preflop_beginner_vs_3bet_4bet', 18),
    ]);
    expect(s.intermediateUnlocked).toBe(false);
  });

  it('初級オープン: 初級基礎 20/20 で解放 / 19 では不可', () => {
    expect(computeUnlockStatus([rec('preflop_beginner', 20)]).beginnerOpenUnlocked).toBe(true);
    expect(computeUnlockStatus([rec('preflop_beginner', 19)]).beginnerOpenUnlocked).toBe(false);
    expect(computeUnlockStatus([]).beginnerOpenUnlocked).toBe(false);
  });

  it('初級 vs オープン: 初級基礎 20/20 で解放 / 19 では不可', () => {
    expect(computeUnlockStatus([rec('preflop_beginner', 20)]).beginnerVsOpenUnlocked).toBe(true);
    expect(computeUnlockStatus([rec('preflop_beginner', 19)]).beginnerVsOpenUnlocked).toBe(false);
    expect(computeUnlockStatus([]).beginnerVsOpenUnlocked).toBe(false);
  });

  it('初級 vs 3bet/4bet: 初級基礎 20/20 で解放 / 19 では不可', () => {
    expect(computeUnlockStatus([rec('preflop_beginner', 20)]).beginnerVs3Bet4BetUnlocked).toBe(true);
    expect(computeUnlockStatus([rec('preflop_beginner', 19)]).beginnerVs3Bet4BetUnlocked).toBe(false);
    expect(computeUnlockStatus([]).beginnerVs3Bet4BetUnlocked).toBe(false);
  });

  it('初級 20/20 → フロップ初級アンロック / 19 では不可', () => {
    expect(computeUnlockStatus([rec('preflop_beginner', 20)]).flopBeginnerUnlocked).toBe(true);
    expect(computeUnlockStatus([rec('preflop_beginner', 19)]).flopBeginnerUnlocked).toBe(false);
    expect(computeUnlockStatus([]).flopBeginnerUnlocked).toBe(false);
  });

  it('フロップ初級 18/20 (90%) → フロップ中級アンロック / 17 では不可 (境界値)', () => {
    expect(computeUnlockStatus([rec('flop_beginner', 18)]).flopIntermediateUnlocked).toBe(true);
    expect(computeUnlockStatus([rec('flop_beginner', 17)]).flopIntermediateUnlocked).toBe(false);
    expect(computeUnlockStatus([]).flopIntermediateUnlocked).toBe(false);
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
    expect(FLOP_INTERMEDIATE_UNLOCK_THRESHOLD).toBe(18);
  });
});

describe('isLevelUnlocked (level.key → ロック判定)', () => {
  const allLocked = {
    beginnerUnlocked: true,
    beginnerOpenUnlocked: false,
    beginnerVsOpenUnlocked: false,
    beginnerVs3Bet4BetUnlocked: false,
    intermediateUnlocked: false,
    advancedUnlocked: false,
    superAdvancedUnlocked: false,
    flopBeginnerUnlocked: false,
    flopIntermediateUnlocked: false,
  };
  const allUnlocked = {
    beginnerUnlocked: true,
    beginnerOpenUnlocked: true,
    beginnerVsOpenUnlocked: true,
    beginnerVs3Bet4BetUnlocked: true,
    intermediateUnlocked: true,
    advancedUnlocked: true,
    superAdvancedUnlocked: false, // 超上級は常に false
    flopBeginnerUnlocked: true,
    flopIntermediateUnlocked: true,
  };

  it('preflop_beginner: 常にアンロック', () => {
    expect(isLevelUnlocked('preflop_beginner', allLocked)).toBe(true);
  });
  it('preflop_beginner_open: beginnerOpenUnlocked に従う', () => {
    expect(isLevelUnlocked('preflop_beginner_open', allLocked)).toBe(false);
    expect(isLevelUnlocked('preflop_beginner_open', allUnlocked)).toBe(true);
  });
  it('preflop_beginner_vs_open: beginnerVsOpenUnlocked に従う', () => {
    expect(isLevelUnlocked('preflop_beginner_vs_open', allLocked)).toBe(false);
    expect(isLevelUnlocked('preflop_beginner_vs_open', allUnlocked)).toBe(true);
  });
  it('preflop_beginner_vs_3bet_4bet: beginnerVs3Bet4BetUnlocked に従う', () => {
    expect(isLevelUnlocked('preflop_beginner_vs_3bet_4bet', allLocked)).toBe(false);
    expect(isLevelUnlocked('preflop_beginner_vs_3bet_4bet', allUnlocked)).toBe(true);
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
  it('flop_beginner: プリフロップ初級クリアで解放 (flopBeginnerUnlocked に従う)', () => {
    expect(isLevelUnlocked('flop_beginner', allLocked)).toBe(false);
    expect(isLevelUnlocked('flop_beginner', allUnlocked)).toBe(true);
  });
  it('flop_intermediate (レンジベット): フロップ初級クリアで解放', () => {
    expect(isLevelUnlocked('flop_intermediate', allLocked)).toBe(false);
    expect(isLevelUnlocked('flop_intermediate', allUnlocked)).toBe(true);
  });
  it('flop_advanced 以降: 未実装でロック', () => {
    expect(isLevelUnlocked('flop_advanced', allUnlocked)).toBe(false);
  });
});

describe('lockHintFor (ロック中ヒント文)', () => {
  it('中級: "プリフロップ初級を全部クリアするとアンロック"', () => {
    expect(lockHintFor('preflop_intermediate')).toBe('プリフロップ初級を全部クリアするとアンロック');
    expect(lockHintFor('preflop_intermediate_ep')).toBe('プリフロップ初級を全部クリアするとアンロック');
  });
  it('上級: "プリフロップ中級で 20pt 取るとアンロック"', () => {
    expect(lockHintFor('preflop_advanced')).toBe('プリフロップ中級で 20pt 取るとアンロック');
  });
  it('超上級: "未実装"', () => {
    expect(lockHintFor('preflop_expert')).toBe('未実装');
  });
  it('初級拡張: "プリフロップ初級 基礎をクリアするとアンロック"', () => {
    expect(lockHintFor('preflop_beginner_open')).toBe('プリフロップ初級 基礎をクリアするとアンロック');
    expect(lockHintFor('preflop_beginner_vs_open')).toBe('プリフロップ初級 基礎をクリアするとアンロック');
    expect(lockHintFor('preflop_beginner_vs_3bet_4bet')).toBe('プリフロップ初級 基礎をクリアするとアンロック');
  });
  it('フロップ初級: "プリフロップ初級 基礎をクリアするとアンロック"', () => {
    expect(lockHintFor('flop_beginner')).toBe('プリフロップ初級 基礎をクリアするとアンロック');
  });
  it('初級: null', () => {
    expect(lockHintFor('preflop_beginner')).toBeNull();
  });
  it('ポストフロップ中級: "ポストフロップ初級をクリアするとアンロック"', () => {
    expect(lockHintFor('srp_non_blind')).toBe('ポストフロップ初級をクリアするとアンロック');
    expect(lockHintFor('3bp_4bp_5bp_blind')).toBe('ポストフロップ初級をクリアするとアンロック');
    expect(lockHintFor('donk_bmcb')).toBe('ポストフロップ初級をクリアするとアンロック');
  });
});
