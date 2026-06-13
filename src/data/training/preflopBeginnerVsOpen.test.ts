import { describe, it, expect } from 'vitest';
import {
  VS_OPEN_OPENERS,
  PER_OPENER,
  VS_OPEN_EXCLUDED_HANDS,
  candidatesFor,
  buildBeginnerVsOpenQuestions,
  vsOpenNodeFile,
  type VsOpenNodes,
} from './preflopBeginnerVsOpen';
import { isEligibleByEvThreshold, isAllMixedStrategy, scoreGentleSelect } from './preflopBeginnerExt';
import { VS_OPEN_PAIRS, type HandStrategy } from './preflopBeginner';
import { EV_RANKING } from '../evRanking';
import type { Hand } from '../../types/strategy';

// EV<=40 かつ AA・KK 以外のハンド一覧 (生成側フィルタと同じ判定の候補母集団)。
const ELIGIBLE: Hand[] = (Object.keys(EV_RANKING) as Hand[]).filter(
  (h) => isEligibleByEvThreshold(h) && h !== 'AA' && h !== 'KK',
);

/** ハンド群を raise=100 (= 非混合) の戦略にした hands マップ。 */
function pureRaise(hands: Hand[]): Record<string, HandStrategy> {
  const out: Record<string, HandStrategy> = {};
  for (const h of hands) out[h] = { allin: 0, raise: 100, call: 0, fold: 0 };
  return out;
}

/** 全 15 ペアを「非混合の eligible ハンド」で埋めたノード。 */
function fullNodes(): VsOpenNodes {
  const pool = ELIGIBLE.slice(0, 20);
  const nodes: VsOpenNodes = {};
  for (const [opener, hero] of VS_OPEN_PAIRS) {
    if (!nodes[opener]) nodes[opener] = {};
    nodes[opener]![hero] = pureRaise(pool);
  }
  return nodes;
}

describe('candidatesFor (vs オープンの出題候補)', () => {
  it('EV<=40 のハンドのみ (EV>40 は除外)', () => {
    const ineligible = (Object.keys(EV_RANKING) as Hand[]).find((h) => !isEligibleByEvThreshold(h))!;
    const out = candidatesFor(pureRaise([ELIGIBLE[0], ineligible]));
    expect(out).toContain(ELIGIBLE[0]);
    expect(out).not.toContain(ineligible);
  });

  it('AA・KK は除外 (簡単すぎるため)', () => {
    const hands: Record<string, HandStrategy> = {
      AA: { allin: 0, raise: 100, call: 0, fold: 0 },
      KK: { allin: 0, raise: 100, call: 0, fold: 0 },
      [ELIGIBLE[0]]: { allin: 0, raise: 100, call: 0, fold: 0 },
    };
    const out = candidatesFor(hands);
    expect(out).not.toContain('AA');
    expect(out).not.toContain('KK');
    expect(out).toContain(ELIGIBLE[0]);
    expect(VS_OPEN_EXCLUDED_HANDS).toEqual(['AA', 'KK']);
  });

  it('全戦略混合 (TT raise33/call40/fold27 等) は除外', () => {
    const tt: HandStrategy = { allin: 0, raise: 33, call: 40, fold: 27 };
    expect(isAllMixedStrategy(tt)).toBe(true);
    const hands: Record<string, HandStrategy> = {
      TT: tt,
      [ELIGIBLE[0]]: { allin: 0, raise: 100, call: 0, fold: 0 },
    };
    const out = candidatesFor(hands);
    expect(out).not.toContain('TT');
    expect(out).toContain(ELIGIBLE[0]);
  });
});

describe('buildBeginnerVsOpenQuestions', () => {
  it('20 問を生成する', () => {
    expect(buildBeginnerVsOpenQuestions(fullNodes())).toHaveLength(20);
  });

  it('アグレッサー(opener)均等 4 問ずつ (5×4=20)', () => {
    // ランダム性があるので複数回まわして毎回 4/4/4/4/4 を確認。
    for (let trial = 0; trial < 30; trial++) {
      const qs = buildBeginnerVsOpenQuestions(fullNodes());
      const byOpener: Record<string, number> = {};
      for (const q of qs) byOpener[q.opener] = (byOpener[q.opener] ?? 0) + 1;
      for (const o of VS_OPEN_OPENERS) expect(byOpener[o]).toBe(PER_OPENER);
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

  it('nodeFile は {opener}r_{hero}.json、hero は opener より後ろの席', () => {
    const qs = buildBeginnerVsOpenQuestions(fullNodes());
    const validPair = new Set(VS_OPEN_PAIRS.map(([o, h]) => `${o}|${h}`));
    for (const q of qs) {
      expect(q.nodeFile).toBe(vsOpenNodeFile(q.opener, q.hero));
      expect(validPair.has(`${q.opener}|${q.hero}`)).toBe(true);
    }
  });

  it('同一アグレッサー内でヒーローを分散 (UTG=4ヒーロー / SB=BBのみ)', () => {
    const qs = buildBeginnerVsOpenQuestions(fullNodes());
    const utgHeroes = new Set(qs.filter((q) => q.opener === 'UTG').map((q) => q.hero));
    // UTG は 5 ヒーローから 4 問 → 4 種類の異なるヒーロー。
    expect(utgHeroes.size).toBe(4);
    // SB アグレッサーは BB のみ (1 ペア) → 4 問とも hero=BB。
    const sbHeroes = qs.filter((q) => q.opener === 'SB');
    expect(sbHeroes.every((q) => q.hero === 'BB')).toBe(true);
  });

  it('同一ノードのハンドは重複しない', () => {
    const qs = buildBeginnerVsOpenQuestions(fullNodes());
    const seen = new Set<string>();
    for (const q of qs) {
      const k = `${q.nodeFile}:${q.hand}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

describe('scoreGentleSelect (vs オープンの採点ルール)', () => {
  it('頻度0%のアクションを選んだら 0pt', () => {
    const s: HandStrategy = { allin: 0, raise: 100, call: 0, fold: 0 };
    expect(scoreGentleSelect(['call'], s)).toBe(0); // call 0%
  });

  it('頻度80%以上のアクションを選ばなかったら 0pt', () => {
    const s: HandStrategy = { allin: 0, raise: 100, call: 0, fold: 0 };
    expect(scoreGentleSelect(['fold'], s)).toBe(0); // fold 0% を選び、raise 100% を漏らした
  });

  it('0%を選ばず 80%以上を漏らさなければ 1pt', () => {
    const s: HandStrategy = { allin: 0, raise: 100, call: 0, fold: 0 };
    expect(scoreGentleSelect(['raise'], s)).toBe(1);
  });

  it('混合 (raise60/fold40) は両方選んでも 1pt (0%なし・80%なし)', () => {
    const s: HandStrategy = { allin: 0, raise: 60, call: 0, fold: 40 };
    expect(scoreGentleSelect(['raise', 'fold'], s)).toBe(1);
  });
});
