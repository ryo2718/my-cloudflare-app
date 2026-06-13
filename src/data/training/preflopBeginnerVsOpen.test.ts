import { describe, it, expect } from 'vitest';
import {
  VS_OPEN_OPENERS,
  TOTAL_QUESTIONS,
  VALUE_QUOTA,
  BLUFF_QUOTA,
  VS_OPEN_EXCLUDED_HANDS,
  candidatesFor,
  buildBeginnerVsOpenQuestions,
  vsOpenNodeFile,
  type VsOpenNodes,
} from './preflopBeginnerVsOpen';
import {
  isEligibleByEvThreshold,
  isAllMixedStrategy,
  isValueRaise,
  isBluffOrSemiBluffRaise,
  scoreGentleSelect,
} from './preflopBeginnerExt';
import { VS_OPEN_PAIRS, type HandStrategy } from './preflopBeginner';
import { EV_RANKING } from '../evRanking';
import type { Hand } from '../../types/strategy';

const topPct = (h: Hand): number => EV_RANKING[h]?.topPct ?? 999;

// 分類が明確になるよう 3 種のハンドプール (EV<=40 / 非AA・KK / 非all-mixed) を用意。
//   value : raise=100               (raiseTotal>=80)
//   bluff : raise=15 / fold=85       (raiseTotal 15, fold が major なので非all-mixed, topPct>=10)
//   rest  : fold=100                 (raiseTotal 0)
const VALUE_POOL: Hand[] = ['QQ', 'JJ', 'AKs', 'AQs', 'TT', 'AJs', 'KQs', 'AQo'] as Hand[];
const BLUFF_POOL: Hand[] = ['ATo', 'KQo', 'AJo'] as Hand[]; // すべて topPct 10〜40
const REST_POOL: Hand[] = ['22', '33', '44', '55', '66', '77', '88', '99'] as Hand[];

function node(): Record<string, HandStrategy> {
  const out: Record<string, HandStrategy> = {};
  for (const h of VALUE_POOL) out[h] = { allin: 0, raise: 100, call: 0, fold: 0 };
  for (const h of BLUFF_POOL) out[h] = { allin: 0, raise: 15, call: 0, fold: 85 };
  for (const h of REST_POOL) out[h] = { allin: 0, raise: 0, call: 0, fold: 100 };
  return out;
}

function fullNodes(): VsOpenNodes {
  const nodes: VsOpenNodes = {};
  for (const [opener, hero] of VS_OPEN_PAIRS) {
    if (!nodes[opener]) nodes[opener] = {};
    nodes[opener]![hero] = node();
  }
  return nodes;
}

describe('candidatesFor (vs オープンの出題候補)', () => {
  it('EV<=40 のハンドのみ (EV>40 は除外)', () => {
    const ineligible = (Object.keys(EV_RANKING) as Hand[]).find((h) => !isEligibleByEvThreshold(h))!;
    const out = candidatesFor({
      [VALUE_POOL[0]]: { allin: 0, raise: 100, call: 0, fold: 0 },
      [ineligible]: { allin: 0, raise: 100, call: 0, fold: 0 },
    });
    expect(out).toContain(VALUE_POOL[0]);
    expect(out).not.toContain(ineligible);
  });

  it('AA・KK は除外 (簡単すぎるため)', () => {
    const out = candidatesFor({
      AA: { allin: 0, raise: 100, call: 0, fold: 0 },
      KK: { allin: 0, raise: 100, call: 0, fold: 0 },
      [VALUE_POOL[0]]: { allin: 0, raise: 100, call: 0, fold: 0 },
    });
    expect(out).not.toContain('AA');
    expect(out).not.toContain('KK');
    expect(out).toContain(VALUE_POOL[0]);
    expect(VS_OPEN_EXCLUDED_HANDS).toEqual(['AA', 'KK']);
  });

  it('全戦略混合 (TT raise33/call40/fold27 等) は除外', () => {
    const tt: HandStrategy = { allin: 0, raise: 33, call: 40, fold: 27 };
    expect(isAllMixedStrategy(tt)).toBe(true);
    const out = candidatesFor({ TT: tt, [VALUE_POOL[0]]: { allin: 0, raise: 100, call: 0, fold: 0 } });
    expect(out).not.toContain('TT');
  });
});

describe('isValueRaise / isBluffOrSemiBluffRaise', () => {
  it('isValueRaise: raise+allin>=80', () => {
    expect(isValueRaise({ allin: 0, raise: 100, call: 0, fold: 0 })).toBe(true);
    expect(isValueRaise({ allin: 40, raise: 45, call: 0, fold: 15 })).toBe(true); // 合計85
    expect(isValueRaise({ allin: 0, raise: 15, call: 0, fold: 85 })).toBe(false);
  });

  it('isBluffOrSemiBluffRaise: raise+allin 10-79 かつ topPct>=10', () => {
    const s: HandStrategy = { allin: 0, raise: 15, call: 0, fold: 85 };
    expect(isBluffOrSemiBluffRaise(s, 14.48)).toBe(true); // ATo 相当
    expect(isBluffOrSemiBluffRaise(s, 5)).toBe(false); // 強すぎ (premium級) は対象外
    expect(isBluffOrSemiBluffRaise({ allin: 0, raise: 0, call: 0, fold: 100 }, 20)).toBe(false); // raise 0%
    expect(isBluffOrSemiBluffRaise({ allin: 0, raise: 100, call: 0, fold: 0 }, 20)).toBe(false); // value
  });
});

describe('buildBeginnerVsOpenQuestions (レイズ枠保証)', () => {
  it('20 問を生成する', () => {
    expect(buildBeginnerVsOpenQuestions(fullNodes())).toHaveLength(TOTAL_QUESTIONS);
  });

  it('バリュー4問 + ブラフ4問を毎回保証 (100 試行)', () => {
    for (let t = 0; t < 100; t++) {
      const qs = buildBeginnerVsOpenQuestions(fullNodes());
      const value = qs.filter((q) => isValueRaise(q.strategy)).length;
      const bluff = qs.filter(
        (q) => !isValueRaise(q.strategy) && isBluffOrSemiBluffRaise(q.strategy, topPct(q.hand)),
      ).length;
      expect(value).toBe(VALUE_QUOTA);
      expect(bluff).toBe(BLUFF_QUOTA);
    }
  });

  it('各問が EV<=40 / AA・KK以外 / 非混合 のハンド', () => {
    const qs = buildBeginnerVsOpenQuestions(fullNodes());
    for (const q of qs) {
      expect(isEligibleByEvThreshold(q.hand)).toBe(true);
      expect(q.hand === 'AA' || q.hand === 'KK').toBe(false);
      expect(isAllMixedStrategy(q.strategy)).toBe(false);
    }
  });

  it('nodeFile は {opener}r_{hero}.json、有効ペアのみ、同一ノードのハンド重複なし', () => {
    const qs = buildBeginnerVsOpenQuestions(fullNodes());
    const validPair = new Set(VS_OPEN_PAIRS.map(([o, h]) => `${o}|${h}`));
    const seen = new Set<string>();
    for (const q of qs) {
      expect(q.nodeFile).toBe(vsOpenNodeFile(q.opener, q.hero));
      expect(validPair.has(`${q.opener}|${q.hero}`)).toBe(true);
      const k = `${q.nodeFile}:${q.hand}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('ポジションは複数アグレッサーに分散する (round-robin)', () => {
    for (let t = 0; t < 20; t++) {
      const qs = buildBeginnerVsOpenQuestions(fullNodes());
      const openers = new Set(qs.map((q) => q.opener));
      expect(openers.size).toBeGreaterThanOrEqual(4); // 5 アグレッサー中ほぼ全て
      expect(VS_OPEN_OPENERS).toContain(qs[0].opener);
    }
  });
});

describe('scoreGentleSelect (vs オープンの採点ルール)', () => {
  it('頻度0%のアクションを選んだら 0pt', () => {
    expect(scoreGentleSelect(['call'], { allin: 0, raise: 100, call: 0, fold: 0 })).toBe(0);
  });
  it('頻度80%以上のアクションを選ばなかったら 0pt', () => {
    expect(scoreGentleSelect(['fold'], { allin: 0, raise: 100, call: 0, fold: 0 })).toBe(0);
  });
  it('0%を選ばず 80%以上を漏らさなければ 1pt', () => {
    expect(scoreGentleSelect(['raise'], { allin: 0, raise: 100, call: 0, fold: 0 })).toBe(1);
  });
  it('混合 (raise60/fold40) は両方選んでも 1pt', () => {
    expect(scoreGentleSelect(['raise', 'fold'], { allin: 0, raise: 60, call: 0, fold: 40 })).toBe(1);
  });
});
