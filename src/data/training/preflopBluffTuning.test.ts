// プリフロップ中級のブラフ調整 (vs_4bet削減 / ピュアブラフ出題 / ブラフ枠強制) の検証。

import { describe, it, expect } from 'vitest';
import {
  generateProblemDistribution,
  isHandEligible,
  handSlotOf,
  generateBBResponseQuestion,
  type StrategiesByOpener,
} from './preflopIntermediate';
import type { HandStrategy } from './preflopBeginner';
import type { Hand } from '../../types/strategy';

const S = (o: Partial<HandStrategy>): HandStrategy => ({ allin: 0, raise: 0, call: 0, fold: 0, ...o });

describe('改訂1: vs_4bet 配分削減', () => {
  it('vs_4bet は 1-3、合計 20、能動シナリオが増える', () => {
    for (let i = 0; i < 300; i++) {
      const d = generateProblemDistribution();
      expect(d.vs4bet).toBeGreaterThanOrEqual(1);
      expect(d.vs4bet).toBeLessThanOrEqual(3);
      expect(d.bb + d.vs3bet + d.vs4bet + d.middleVsOpen + d.riskyOpen).toBe(20);
    }
  });
});

describe('改訂2: ピュアブラフを出題対象に含める', () => {
  it('ピュアブラフ (ランク下位の単一100%レイズ/オールイン) は eligible', () => {
    expect(isHandEligible('A5s' as Hand, S({ raise: 100 }))).toBe(true);   // topPct 10.71
    expect(isHandEligible('A7s' as Hand, S({ allin: 100 }))).toBe(true);   // topPct 12.37
    expect(isHandEligible('T9s' as Hand, S({ raise: 100 }))).toBe(true);   // topPct 12.97
  });
  it('ピュアバリュー (ランク上位の単一100%レイズ) は従来どおり除外', () => {
    expect(isHandEligible('AA' as Hand, S({ raise: 100 }))).toBe(false);   // topPct 0.45
    expect(isHandEligible('AKs' as Hand, S({ raise: 100 }))).toBe(false);  // topPct 1.66
    expect(isHandEligible('KQs' as Hand, S({ raise: 100 }))).toBe(false);  // topPct 4.83 (<=8)
  });
  it('ピュア call/fold は (ランクに関係なく) 除外', () => {
    expect(isHandEligible('A5s' as Hand, S({ call: 100 }))).toBe(false);
    expect(isHandEligible('72o' as Hand, S({ fold: 100 }))).toBe(false);
  });
});

describe('改訂3: ブラフ/バリュー枠の判定とサンプリング', () => {
  it('handSlotOf: ランク下位の攻撃=bluff / 上位=value / 受け身=neutral', () => {
    expect(handSlotOf('A5s' as Hand, S({ raise: 100 }))).toBe('bluff');   // topPct 10.71 > 10
    expect(handSlotOf('A4s' as Hand, S({ raise: 47.5, call: 52.5 }))).toBe('bluff'); // 13.27
    expect(handSlotOf('AA' as Hand, S({ raise: 100 }))).toBe('value');     // 0.45 <= 5
    expect(handSlotOf('A9s' as Hand, S({ call: 100 }))).toBe('neutral');   // 攻撃でない
  });

  it('ブラフ枠強制でブラフ問題が一定比率で出題される', () => {
    const data: StrategiesByOpener = {
      BTN: {
        A5s: S({ raise: 100 }),            // pure bluff (eligible)
        A4s: S({ raise: 47.5, call: 52.5 }), // mixed bluff (eligible)
        K6s: S({ raise: 26.5, call: 73.5 }), // bluff (eligible)
        '99': S({ raise: 71, call: 29 }),    // value (eligible, topPct 4.22)
        AKo: S({ raise: 100 }),              // pure value (excluded)
        A9s: S({ call: 100 }),               // pure call (excluded)
      },
    };
    let bluff = 0;
    let value = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const q = generateBBResponseQuestion(data);
      if (q.slot === 'bluff') bluff++;
      else if (q.slot === 'value') value++;
    }
    // 35% 強制 + 自然分でブラフが多数。両枠が出ること & ブラフが十分出ることを担保。
    expect(bluff / N).toBeGreaterThanOrEqual(0.3);
    expect(value).toBeGreaterThan(0);
  });
});
