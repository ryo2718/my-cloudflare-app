// プリフロップ初級拡張 共通土台 (EV閾値 / 優しい採点 / 出題規則ヘルパ) のユニットテスト。

import { describe, it, expect } from 'vitest';
import type { HandStrategy } from './preflopBeginner';
import type { Hand } from '../../types/strategy';
import {
  EV_BEGINNER_EXT_MAX_TOPPCT,
  isEligibleByEvThreshold,
  scoreGentleSelect,
  scoreGentleSlider,
  SLIDER_TOLERANCE_BAND,
  isAllMixedStrategy,
  isHandActiveInAction,
  isRaiseDominant,
  isBoundary,
} from './preflopBeginnerExt';

const S = (o: Partial<HandStrategy>): HandStrategy => ({ allin: 0, raise: 0, call: 0, fold: 0, ...o });

describe('EV 閾値フィルタ (topPct <= 40)', () => {
  it('閾値定数は 40', () => {
    expect(EV_BEGINNER_EXT_MAX_TOPPCT).toBe(40);
  });
  it('上位〜average は対象、weak以下・最弱は除外', () => {
    expect(isEligibleByEvThreshold('AA' as Hand)).toBe(true);   // 0.45
    expect(isEligibleByEvThreshold('A4s' as Hand)).toBe(true);  // 13.27
    expect(isEligibleByEvThreshold('QTo' as Hand)).toBe(true);  // 23.53
    expect(isEligibleByEvThreshold('K9o' as Hand)).toBe(true);  // 31.22 (average, 含める)
    expect(isEligibleByEvThreshold('A4o' as Hand)).toBe(false); // 40.57 (weak)
    expect(isEligibleByEvThreshold('82o' as Hand)).toBe(false); // 95 (garbage)
    expect(isEligibleByEvThreshold('73o' as Hand)).toBe(false); // 87 (garbage)
  });
});

describe('優しい select 採点 (0pt / 1pt・減点なし)', () => {
  // QQ raise60/call40 (0%=allin,fold)。
  const qq = S({ raise: 60, call: 40 });
  it('0%のアクションを選んだ → 0pt', () => {
    expect(scoreGentleSelect(['raise', 'fold'], qq)).toBe(0); // fold 0% を選んだ
    expect(scoreGentleSelect(['allin'], qq)).toBe(0);          // allin 0%
  });
  it('80%以上のアクションを選ばなかった → 0pt', () => {
    const aa = S({ raise: 100 });
    expect(scoreGentleSelect(['call'], aa)).toBe(0); // raise100 を漏らした (かつ call 0% も該当)
    const k = S({ raise: 85, call: 15 });
    expect(scoreGentleSelect(['call'], k)).toBe(0);  // raise85>=80 を漏らした
  });
  it('0%を選ばず・80%+を漏らさない → 1pt', () => {
    expect(scoreGentleSelect(['raise', 'call'], qq)).toBe(1); // 両方>0、80%+なし
    expect(scoreGentleSelect(['raise'], qq)).toBe(1);          // raise>0、80%+なし
    const aa = S({ raise: 100 });
    expect(scoreGentleSelect(['raise'], aa)).toBe(1);          // raise100 を選んだ
  });
});

describe('優しい slider 採点 (0pt / 0.5pt・±20%)', () => {
  it('既定許容幅は 20', () => {
    expect(SLIDER_TOLERANCE_BAND).toBe(20);
  });
  it('±20% 以内なら 0.5pt、外なら 0pt', () => {
    expect(scoreGentleSlider(100, 100)).toBe(0.5); // ぴったり
    expect(scoreGentleSlider(80, 100)).toBe(0.5);  // ちょうど ±20
    expect(scoreGentleSlider(70, 100)).toBe(0);    // ±30 → 外
    expect(scoreGentleSlider(0, 0)).toBe(0.5);
    expect(scoreGentleSlider(20, 0)).toBe(0.5);    // ちょうど ±20
    expect(scoreGentleSlider(30, 0)).toBe(0);
  });
});

describe('出題規則ヘルパ', () => {
  it('isAllMixedStrategy: 80%major なしで true', () => {
    expect(isAllMixedStrategy(S({ raise: 33, call: 40, fold: 27 }))).toBe(true);  // TT 例
    expect(isAllMixedStrategy(S({ raise: 100 }))).toBe(false);                    // AA
    expect(isAllMixedStrategy(S({ raise: 85, call: 15 }))).toBe(false);           // 85 major
    expect(isAllMixedStrategy(S({ raise: 79, fold: 21 }))).toBe(true);            // 79 < 80
  });
  it('isHandActiveInAction: 指定アクション頻度>0', () => {
    expect(isHandActiveInAction(S({ raise: 20, fold: 80 }), 'raise')).toBe(true);
    expect(isHandActiveInAction(S({ fold: 100 }), 'raise')).toBe(false); // 27o vs 3bet 例
    expect(isHandActiveInAction(S({ call: 50, fold: 50 }), 'call')).toBe(true);
  });
  it('isRaiseDominant: 既定90%以上', () => {
    expect(isRaiseDominant(S({ raise: 90 }))).toBe(true);
    expect(isRaiseDominant(S({ raise: 89 }))).toBe(false);
    expect(isRaiseDominant(S({ raise: 50 }), 50)).toBe(true);
  });
  it('isBoundary: raise が [10,90] の混合', () => {
    expect(isBoundary(S({ raise: 47.5, fold: 52.5 }))).toBe(true);
    expect(isBoundary(S({ raise: 100 }))).toBe(false);  // 振り切り
    expect(isBoundary(S({ fold: 100 }))).toBe(false);   // raise 0
    expect(isBoundary(S({ raise: 10, fold: 90 }))).toBe(true);  // 下限
    expect(isBoundary(S({ raise: 90, fold: 10 }))).toBe(true);  // 上限
    expect(isBoundary(S({ raise: 5, fold: 95 }))).toBe(false);
  });
});
