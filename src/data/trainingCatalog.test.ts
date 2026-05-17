import { describe, it, expect } from 'vitest';
import {
  TRAINING_CATALOG,
  isPlanned,
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

describe('isPlanned helper', () => {
  it('points !== null は planned (実装予定)', () => {
    expect(isPlanned(TRAINING_CATALOG[0].levels[0])).toBe(true); // preflop_beginner
    expect(isPlanned(TRAINING_CATALOG[0].levels[1])).toBe(true); // preflop_intermediate
  });

  it('points === null は not-planned (未実装、表示は「未実装」)', () => {
    expect(isPlanned(TRAINING_CATALOG[0].levels[2])).toBe(false); // preflop_advanced
    expect(isPlanned(TRAINING_CATALOG[1].levels[0])).toBe(false); // flop_beginner
  });
});
