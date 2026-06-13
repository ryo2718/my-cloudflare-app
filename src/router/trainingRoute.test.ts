import { describe, it, expect } from 'vitest';
import { matchTrainingRoute } from './trainingRoute';
import { TRAINING_CATALOG, isPlayable, trainingPath } from '../data/trainingCatalog';

describe('matchTrainingRoute', () => {
  it('数字を含む slug (flop-cb-3bp) の play をマッチする (回帰: 数字欠落でホームに戻るバグ)', () => {
    const m = matchTrainingRoute('/training/flop-cb-3bp/play');
    expect(m).not.toBeNull();
    expect(m?.level.key).toBe('flop_cb_3bp');
    expect(m?.screen).toBe('play');
  });

  it('flop-cb-srp の play もマッチする', () => {
    expect(matchTrainingRoute('/training/flop-cb-srp/play')?.level.key).toBe('flop_cb_srp');
  });

  it('実装済み全 level の confirm/play/result/rules パスがマッチする', () => {
    const levels = TRAINING_CATALOG.flatMap((c) => c.levels).filter(isPlayable);
    expect(levels.length).toBeGreaterThan(0);
    for (const lv of levels) {
      for (const screen of ['confirm', 'play', 'result', 'rules'] as const) {
        const m = matchTrainingRoute(trainingPath(lv.key, screen));
        expect(m, `${lv.key}/${screen} がマッチしない`).not.toBeNull();
        expect(m?.level.key).toBe(lv.key);
        expect(m?.screen).toBe(screen);
      }
    }
  });

  it('review パス (index 付き) もマッチする', () => {
    const m = matchTrainingRoute('/training/flop-cb-3bp/review/2');
    expect(m).toMatchObject({ screen: 'review', index: 2 });
    expect(m?.level.key).toBe('flop_cb_3bp');
  });

  it('未知 slug / 不正 screen は null', () => {
    expect(matchTrainingRoute('/training/nope/play')).toBeNull();
    expect(matchTrainingRoute('/training/flop-cb-3bp/bogus')).toBeNull();
  });
});
