import { describe, it, expect } from 'vitest';
import {
  TRAINING_CATALOG,
  TRAINING_RESULT_DISPLAY,
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

  it('preflop 初級: points=1, timeLimitSec=none', () => {
    const beginner = TRAINING_CATALOG[0].levels[0];
    expect(beginner.key).toBe('preflop_beginner');
    expect(beginner.points).toBe(1);
    expect(beginner.timeLimitSec).toBe('none');
  });

  it('preflop 中級: points=3, timeLimitSec=20', () => {
    const intermediate = TRAINING_CATALOG[0].levels[1];
    expect(intermediate.key).toBe('preflop_intermediate');
    expect(intermediate.points).toBe(3);
    expect(intermediate.timeLimitSec).toBe(20);
  });

  it('全 8 level は implemented=false (現状)', () => {
    const allLevels = TRAINING_CATALOG.flatMap((c) => c.levels);
    expect(allLevels).toHaveLength(8);
    expect(allLevels.every((l) => l.implemented === false)).toBe(true);
  });

  it('flop カテゴリは全 level が points=null (未実装)', () => {
    const flop = TRAINING_CATALOG[1];
    expect(flop.levels.every((l) => l.points === null)).toBe(true);
  });
});

describe('TRAINING_RESULT_DISPLAY (AccountPage 用 4 種固定)', () => {
  it('プリフロ / フロップの 初級・中級 4 種', () => {
    expect(TRAINING_RESULT_DISPLAY.map((x) => x.key)).toEqual([
      'preflop_beginner',
      'preflop_intermediate',
      'flop_beginner',
      'flop_intermediate',
    ]);
  });

  it('label に日本語名', () => {
    expect(TRAINING_RESULT_DISPLAY[0].label).toBe('プリフロップ初級');
    expect(TRAINING_RESULT_DISPLAY[3].label).toBe('フロップ中級');
  });
});
