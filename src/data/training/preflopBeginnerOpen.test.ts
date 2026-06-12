import { describe, it, expect } from 'vitest';
import {
  OPEN_POSITIONS,
  PER_POSITION,
  MAX_BOUNDARY,
  SB_RAISE_MIN,
  TOO_STRONG_MAX_TOPPCT,
  isTooStrongForBeginner,
  candidatesFor,
  buildBeginnerOpenQuestions,
  type NodesByPosition,
} from './preflopBeginnerOpen';
import { isEligibleByEvThreshold, isBoundary } from './preflopBeginnerExt';
import { EV_RANKING } from '../evRanking';
import type { HandStrategy } from './preflopBeginner';
import type { Hand, Position } from '../../types/strategy';

// 出題候補 = EV 閾値 (topPct<=40) かつ 強すぎない (AQo 未満でない) ハンド。
const ELIGIBLE: Hand[] = (Object.keys(EV_RANKING) as Hand[]).filter(
  (h) => isEligibleByEvThreshold(h) && !isTooStrongForBeginner(h),
);

/** 指定ハンド群を raise=value の戦略にした hands マップ。 */
function handsWithRaise(hands: Hand[], raise: number): Record<string, HandStrategy> {
  const out: Record<string, HandStrategy> = {};
  for (const h of hands) out[h] = { fold: 100 - raise, call: 0, raise, allin: 0 };
  return out;
}

/** 全ポジションを「非境界の eligible ハンド (raise=100)」で埋めたノード。 */
function fullNodes(): NodesByPosition {
  const pool = ELIGIBLE.slice(0, 12);
  const nodes: NodesByPosition = {};
  for (const pos of OPEN_POSITIONS) nodes[pos] = handsWithRaise(pool, 100);
  return nodes;
}

describe('isTooStrongForBeginner (強すぎるハンド除外)', () => {
  it('閾値は topPct < 7.25 (AQo を含めて除外)', () => {
    expect(TOO_STRONG_MAX_TOPPCT).toBe(7.25);
  });

  it('AQo・AJs・88 とそれ以上に強いハンドは除外対象 (true)', () => {
    for (const h of ['AQo', 'AJs', '88', 'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '77', 'AKs', 'AKo', 'AQs', 'ATs', 'KQs', 'KJs'] as Hand[]) {
      expect(isTooStrongForBeginner(h)).toBe(true);
    }
  });

  it('AQo より弱いハンド (topPct>=7.25) は除外しない (false)', () => {
    // QJs(7.84) / KTs(7.54) / KQo(12.07) / ATo(14.48) などは残る。
    for (const h of ['QJs', 'KTs', 'KQo', 'AJo', 'ATo', 'KJo', '66', '55', '44', '33', '22'] as Hand[]) {
      expect(isTooStrongForBeginner(h)).toBe(false);
    }
  });

  it('未登録ハンドは false', () => {
    expect(isTooStrongForBeginner('72o' as Hand)).toBe(false);
  });
});

describe('candidatesFor', () => {
  it('強すぎるハンド (AQo 以上) は候補から除外', () => {
    const hands = handsWithRaise([ELIGIBLE[0], 'AQo' as Hand, 'AA' as Hand, '88' as Hand], 100);
    const out = candidatesFor('UTG', hands);
    expect(out).toContain(ELIGIBLE[0]);
    expect(out).not.toContain('AQo');
    expect(out).not.toContain('AA');
    expect(out).not.toContain('88');
  });

  it('EV<=40 のハンドのみ候補 (EV>40 は除外)', () => {
    const ineligible = (Object.keys(EV_RANKING) as Hand[]).find((h) => !isEligibleByEvThreshold(h))!;
    const hands = handsWithRaise([ELIGIBLE[0], ineligible], 100);
    const out = candidatesFor('UTG', hands);
    expect(out).toContain(ELIGIBLE[0]);
    expect(out).not.toContain(ineligible);
  });

  it('SB は追加で raise>=90 のみ (混合 raise<90 は除外)', () => {
    const strong = ELIGIBLE[0];
    const mixed = ELIGIBLE[1];
    const hands: Record<string, HandStrategy> = {
      [strong]: { fold: 0, call: 0, raise: 100, allin: 0 },
      [mixed]: { fold: 50, call: 0, raise: 50, allin: 0 },
    };
    const sb = candidatesFor('SB', hands);
    expect(sb).toContain(strong);
    expect(sb).not.toContain(mixed);
    // 他ポジションでは raise<90 でも候補に含まれる。
    const utg = candidatesFor('UTG', hands);
    expect(utg).toContain(mixed);
  });

  it('SB_RAISE_MIN は 90', () => {
    expect(SB_RAISE_MIN).toBe(90);
  });
});

describe('buildBeginnerOpenQuestions', () => {
  it('5ポジション × PER_POSITION = 20 問を生成 (均等配分)', () => {
    const qs = buildBeginnerOpenQuestions(fullNodes());
    expect(qs).toHaveLength(OPEN_POSITIONS.length * PER_POSITION);
    expect(qs).toHaveLength(20);
    const byPos: Record<string, number> = {};
    for (const q of qs) byPos[q.position] = (byPos[q.position] ?? 0) + 1;
    for (const pos of OPEN_POSITIONS) expect(byPos[pos]).toBe(PER_POSITION);
  });

  it('全問が EV<=40 かつ AQo 未満の強さ (強ハンド除外)', () => {
    const qs = buildBeginnerOpenQuestions(fullNodes());
    for (const q of qs) {
      expect(isEligibleByEvThreshold(q.hand)).toBe(true);
      expect(isTooStrongForBeginner(q.hand)).toBe(false);
    }
  });

  it('raisePct は GTO の raise 値、nodeFile は {pos}.json', () => {
    const qs = buildBeginnerOpenQuestions(fullNodes());
    for (const q of qs) {
      expect(q.raisePct).toBe(100);
      expect(q.nodeFile).toBe(`${q.position.toLowerCase()}.json`);
    }
  });

  it('境界 (raise 混合) 問題は全体で MAX_BOUNDARY 以下', () => {
    // 全ポジションを境界ハンド (raise=50) だけで埋める → キャップが効く。
    const pool = ELIGIBLE.slice(0, 12);
    const nodes: NodesByPosition = {};
    for (const pos of OPEN_POSITIONS) {
      // SB は raise>=90 必須なので候補ゼロになる。EP/LP/BTN のみ境界候補。
      nodes[pos] = handsWithRaise(pool, 50);
    }
    const qs = buildBeginnerOpenQuestions(nodes);
    const boundaryCount = qs.filter((q) => q.boundary).length;
    expect(boundaryCount).toBeLessThanOrEqual(MAX_BOUNDARY);
    // boundary フラグは isBoundary と整合。
    for (const q of qs) {
      const s = nodes[q.position as Position]![q.hand]!;
      expect(q.boundary).toBe(isBoundary(s));
    }
  });

  it('ノードが無いポジションはスキップ (その分だけ問題数が減る)', () => {
    const nodes = fullNodes();
    delete nodes.SB;
    const qs = buildBeginnerOpenQuestions(nodes);
    expect(qs.every((q) => q.position !== 'SB')).toBe(true);
    expect(qs).toHaveLength(4 * PER_POSITION);
  });
});
