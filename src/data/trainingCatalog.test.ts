import { describe, it, expect } from 'vitest';
import {
  TRAINING_CATALOG,
  isPlanned,
  isPlayable,
  formatLevelInfo,
  trainingPath,
} from './trainingCatalog';

describe('TRAINING_CATALOG', () => {
  it('2 カテゴリ (preflop / flop)', () => {
    expect(TRAINING_CATALOG.map((c) => c.key)).toEqual(['preflop', 'flop']);
  });

  it('各カテゴリ 4 レベル', () => {
    for (const cat of TRAINING_CATALOG) {
      expect(cat.levels).toHaveLength(4);
    }
  });

  it('preflop 初級: points=1, questionCount=20, subtitle=オープンレンジ, implemented=true', () => {
    const beginner = TRAINING_CATALOG[0].levels[0];
    expect(beginner.key).toBe('preflop_beginner');
    expect(beginner.points).toBe(1);
    expect(beginner.questionCount).toBe(20);
    expect(beginner.timeLimitSec).toBe('none');
    expect(beginner.subtitle).toBe('オープンレンジ');
    expect(beginner.implemented).toBe(true);
  });

  it('preflop 中級: points=3, timeLimitSec=20, subtitle=vs open, implemented=true', () => {
    const intermediate = TRAINING_CATALOG[0].levels[1];
    expect(intermediate.key).toBe('preflop_intermediate');
    expect(intermediate.points).toBe(3);
    expect(intermediate.questionCount).toBe(20);
    expect(intermediate.timeLimitSec).toBe(20);
    expect(intermediate.subtitle).toBe('vs open');
    expect(intermediate.implemented).toBe(true);
  });

  it('preflop 上級/超上級 と flop 全 level は implemented=false', () => {
    expect(TRAINING_CATALOG[0].levels[2].implemented).toBe(false);
    expect(TRAINING_CATALOG[0].levels[3].implemented).toBe(false);
    expect(TRAINING_CATALOG[1].levels.every((l) => l.implemented === false)).toBe(true);
  });

  it('preflop 上級/超上級 と flop 全 level は questionCount=null (未計画)', () => {
    expect(TRAINING_CATALOG[0].levels[2].questionCount).toBeNull();
    expect(TRAINING_CATALOG[0].levels[3].questionCount).toBeNull();
    expect(TRAINING_CATALOG[1].levels.every((l) => l.questionCount === null)).toBe(true);
  });
});

describe('helpers', () => {
  it('isPlanned: questionCount !== null は planned', () => {
    expect(isPlanned(TRAINING_CATALOG[0].levels[0])).toBe(true);
    expect(isPlanned(TRAINING_CATALOG[0].levels[1])).toBe(true);
    expect(isPlanned(TRAINING_CATALOG[0].levels[2])).toBe(false);
    expect(isPlanned(TRAINING_CATALOG[1].levels[0])).toBe(false);
  });

  it('isPlayable: implemented=true かつ pt/問数あり', () => {
    expect(isPlayable(TRAINING_CATALOG[0].levels[0])).toBe(true);
    expect(isPlayable(TRAINING_CATALOG[0].levels[1])).toBe(true);
    expect(isPlayable(TRAINING_CATALOG[0].levels[2])).toBe(false);
    expect(isPlayable(TRAINING_CATALOG[1].levels[0])).toBe(false);
  });

  it('formatLevelInfo: "1pt × 20問・制限時間なし"', () => {
    expect(formatLevelInfo(TRAINING_CATALOG[0].levels[0])).toBe('1pt × 20問・制限時間なし');
  });

  it('formatLevelInfo: "3pt × 20問・制限時間 20s"', () => {
    expect(formatLevelInfo(TRAINING_CATALOG[0].levels[1])).toBe('3pt × 20問・制限時間 20s');
  });

  it('trainingPath: snake_case → kebab-case slug', () => {
    expect(trainingPath('preflop_beginner', 'confirm')).toBe('/training/preflop-beginner/confirm');
    expect(trainingPath('preflop_intermediate', 'play')).toBe('/training/preflop-intermediate/play');
    expect(trainingPath('preflop_advanced', 'result')).toBe('/training/preflop-advanced/result');
  });
});
