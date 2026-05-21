import { describe, it, expect } from 'vitest';
import {
  TRAINING_CATALOG,
  isPlanned,
  isPlayable,
  formatLevelInfo,
  formatScorePct,
  maxScoreFor,
  trainingPath,
} from './trainingCatalog';

describe('TRAINING_CATALOG', () => {
  it('2 カテゴリ (preflop / flop)', () => {
    expect(TRAINING_CATALOG.map((c) => c.key)).toEqual(['preflop', 'flop']);
  });

  it('preflop 7 レベル (初級/中級総合/EP/LP/Blind/上級/超上級), flop 4 レベル', () => {
    expect(TRAINING_CATALOG[0].levels).toHaveLength(7);
    expect(TRAINING_CATALOG[1].levels).toHaveLength(4);
  });

  it('中級ポジション別 (EP/LP/Blind) が中級総合の直後に並ぶ', () => {
    expect(TRAINING_CATALOG[0].levels.map((l) => l.key)).toEqual([
      'preflop_beginner',
      'preflop_intermediate',
      'preflop_intermediate_ep',
      'preflop_intermediate_lp',
      'preflop_intermediate_blind',
      'preflop_advanced',
      'preflop_expert',
    ]);
  });

  it('中級 EP/LP=20問, Blind=30問, 全て implemented=true・20s', () => {
    const [ep, lp, blind] = [
      TRAINING_CATALOG[0].levels[2],
      TRAINING_CATALOG[0].levels[3],
      TRAINING_CATALOG[0].levels[4],
    ];
    expect([ep.key, lp.key, blind.key]).toEqual([
      'preflop_intermediate_ep', 'preflop_intermediate_lp', 'preflop_intermediate_blind',
    ]);
    expect([ep.questionCount, lp.questionCount, blind.questionCount]).toEqual([20, 20, 30]);
    expect([ep.implemented, lp.implemented, blind.implemented]).toEqual([true, true, true]);
    expect([ep.timeLimitSec, lp.timeLimitSec, blind.timeLimitSec]).toEqual([20, 20, 20]);
  });

  it('preflop 初級: points=1, questionCount=20, implemented=true', () => {
    const beginner = TRAINING_CATALOG[0].levels[0];
    expect(beginner.key).toBe('preflop_beginner');
    expect(beginner.points).toBe(1);
    expect(beginner.questionCount).toBe(20);
    expect(beginner.timeLimitSec).toBe('none');
    expect(beginner.implemented).toBe(true);
  });

  it('preflop 中級: points=1 (best_score がそのまま pt), timeLimitSec=20, implemented=true', () => {
    const intermediate = TRAINING_CATALOG[0].levels[1];
    expect(intermediate.key).toBe('preflop_intermediate');
    expect(intermediate.points).toBe(1);
    expect(intermediate.questionCount).toBe(20);
    expect(intermediate.timeLimitSec).toBe(20);
    expect(intermediate.implemented).toBe(true);
  });

  it('preflop 上級/超上級 と flop 全 level は implemented=false', () => {
    expect(TRAINING_CATALOG[0].levels[5].implemented).toBe(false); // 上級
    expect(TRAINING_CATALOG[0].levels[6].implemented).toBe(false); // 超上級
    expect(TRAINING_CATALOG[1].levels.every((l) => l.implemented === false)).toBe(true);
  });

  it('preflop 上級/超上級 と flop 全 level は questionCount=null (未計画)', () => {
    expect(TRAINING_CATALOG[0].levels[5].questionCount).toBeNull();
    expect(TRAINING_CATALOG[0].levels[6].questionCount).toBeNull();
    expect(TRAINING_CATALOG[1].levels.every((l) => l.questionCount === null)).toBe(true);
  });
});

describe('helpers', () => {
  it('isPlanned: questionCount !== null は planned', () => {
    expect(isPlanned(TRAINING_CATALOG[0].levels[0])).toBe(true);
    expect(isPlanned(TRAINING_CATALOG[0].levels[1])).toBe(true);
    expect(isPlanned(TRAINING_CATALOG[0].levels[2])).toBe(true);  // EP (questionCount=20)
    expect(isPlanned(TRAINING_CATALOG[0].levels[5])).toBe(false); // 上級 (未計画)
    expect(isPlanned(TRAINING_CATALOG[1].levels[0])).toBe(false);
  });

  it('isPlayable: implemented=true かつ pt/問数あり', () => {
    expect(isPlayable(TRAINING_CATALOG[0].levels[0])).toBe(true);
    expect(isPlayable(TRAINING_CATALOG[0].levels[1])).toBe(true);
    expect(isPlayable(TRAINING_CATALOG[0].levels[2])).toBe(true);  // EP
    expect(isPlayable(TRAINING_CATALOG[0].levels[5])).toBe(false); // 上級 (未実装)
    expect(isPlayable(TRAINING_CATALOG[1].levels[0])).toBe(false);
  });

  it('formatLevelInfo: "1pt × 20問・制限時間なし"', () => {
    expect(formatLevelInfo(TRAINING_CATALOG[0].levels[0])).toBe('1pt × 20問・制限時間なし');
  });

  it('formatLevelInfo: 中級は "20問・最大 40pt・制限時間 20s" 形式', () => {
    expect(formatLevelInfo(TRAINING_CATALOG[0].levels[1])).toBe('20問・最大 40pt・制限時間 20s');
  });

  it('trainingPath: snake_case → kebab-case slug', () => {
    expect(trainingPath('preflop_beginner', 'confirm')).toBe('/training/preflop-beginner/confirm');
    expect(trainingPath('preflop_intermediate', 'play')).toBe('/training/preflop-intermediate/play');
    expect(trainingPath('preflop_advanced', 'result')).toBe('/training/preflop-advanced/result');
  });
});

describe('maxScoreFor', () => {
  it('初級: 20 (questionCount)', () => {
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[0])).toBe(20);
  });
  it('中級: 40 (questionCount * 2)', () => {
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[1])).toBe(40);
  });
  it('中級ポジション別: EP/LP=20, Blind=30 (questionCount, ÷2 済の満点)', () => {
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[2])).toBe(20); // EP
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[3])).toBe(20); // LP
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[4])).toBe(30); // Blind
  });
  it('未計画 (questionCount=null) → 0', () => {
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[5])).toBe(0); // 上級
    expect(maxScoreFor(TRAINING_CATALOG[1].levels[0])).toBe(0);
  });
});

describe('formatScorePct (整数のみ無小数、小数あれば 1 桁)', () => {
  it('20/20 → "100%"', () => {
    expect(formatScorePct(20, 20)).toBe('100%');
  });
  it('27/40 → "67.5%"', () => {
    expect(formatScorePct(27, 40)).toBe('67.5%');
  });
  it('15/20 → "75%" (整数)', () => {
    expect(formatScorePct(15, 20)).toBe('75%');
  });
  it('1/40 → "2.5%"', () => {
    expect(formatScorePct(1, 40)).toBe('2.5%');
  });
  it('0/20 → "0%"', () => {
    expect(formatScorePct(0, 20)).toBe('0%');
  });
  it('max=0 (未計画) → "—"', () => {
    expect(formatScorePct(0, 0)).toBe('—');
  });
});
