import { describe, it, expect } from 'vitest';
import {
  TOTAL_QUESTIONS,
  VS3BET_TARGET,
  VS4BET_TARGET,
  VALUE_QUOTA,
  BLUFF_QUOTA,
  VS3BET_EXCLUDED_HANDS,
  candidatesFor,
  buildBeginnerVs3Bet4BetQuestions,
  vs3betNodeFile,
  vs4betNodeFile,
  type LoadedNode,
  type VsRaiseKind,
} from './preflopBeginnerVs3Bet4Bet';
import { isEligibleByEvThreshold, isAllMixedStrategy, isValueRaise, isBluffOrSemiBluffRaise } from './preflopBeginnerExt';
import { VS_OPEN_PAIRS, type HandStrategy } from './preflopBeginner';
import { EV_RANKING } from '../evRanking';
import type { Hand } from '../../types/strategy';

const topPct = (h: Hand): number => EV_RANKING[h]?.topPct ?? 999;

const VALUE_POOL: Hand[] = ['QQ', 'JJ', 'AKs', 'AQs', 'TT', 'AJs', 'KQs', 'AQo'] as Hand[];
const BLUFF_POOL: Hand[] = ['ATo', 'KQo', 'AJo'] as Hand[]; // topPct 10〜40
const REST_POOL: Hand[] = ['22', '33', '44', '55', '66', '77', '88', '99'] as Hand[];

function node(): Record<string, HandStrategy> {
  const out: Record<string, HandStrategy> = {};
  out.AA = { allin: 0, raise: 100, call: 0, fold: 0 }; // vs3bet=除外 / vs4bet=出題
  out.KK = { allin: 0, raise: 100, call: 0, fold: 0 };
  for (const h of VALUE_POOL) out[h] = { allin: 0, raise: 100, call: 0, fold: 0 };
  for (const h of BLUFF_POOL) out[h] = { allin: 0, raise: 15, call: 0, fold: 85 };
  for (const h of REST_POOL) out[h] = { allin: 0, raise: 0, call: 0, fold: 100 };
  return out;
}

function fullNodes(): LoadedNode[] {
  const out: LoadedNode[] = [];
  for (const [opener, threebettor] of VS_OPEN_PAIRS) {
    out.push({ kind: 'vs3bet', opener, threebettor, hands: node() });
    out.push({ kind: 'vs4bet', opener, threebettor, hands: node() });
  }
  return out;
}

describe('candidatesFor (vs 3bet/4bet)', () => {
  it('EV<=40 のみ (EV>40 除外)', () => {
    const ineligible = (Object.keys(EV_RANKING) as Hand[]).find((h) => !isEligibleByEvThreshold(h))!;
    const out = candidatesFor('vs3bet', {
      [VALUE_POOL[0]]: { allin: 0, raise: 100, call: 0, fold: 0 },
      [ineligible]: { allin: 0, raise: 100, call: 0, fold: 0 },
    });
    expect(out).toContain(VALUE_POOL[0]);
    expect(out).not.toContain(ineligible);
  });

  it('vs 3bet は AA・KK を除外、vs 4bet は AA・KK を含む', () => {
    const hands = node();
    const c3 = candidatesFor('vs3bet', hands);
    const c4 = candidatesFor('vs4bet', hands);
    expect(c3).not.toContain('AA');
    expect(c3).not.toContain('KK');
    expect(c4).toContain('AA');
    expect(c4).toContain('KK');
    expect(VS3BET_EXCLUDED_HANDS).toEqual(['AA', 'KK']);
  });

  it('全戦略混合 (TT raise33/call40/fold27) は除外', () => {
    const out = candidatesFor('vs4bet', { TT: { allin: 0, raise: 33, call: 40, fold: 27 } });
    expect(isAllMixedStrategy({ allin: 0, raise: 33, call: 40, fold: 27 })).toBe(true);
    expect(out).not.toContain('TT');
  });

  it('ノードに存在しないハンド (例 72o) は候補に出ない (参加していない)', () => {
    const out = candidatesFor('vs3bet', node());
    expect(out).not.toContain('72o');
  });
});

describe('buildBeginnerVs3Bet4BetQuestions (レイズ枠 + シナリオ配分)', () => {
  it('20 問を生成する', () => {
    expect(buildBeginnerVs3Bet4BetQuestions(fullNodes())).toHaveLength(TOTAL_QUESTIONS);
  });

  it('バリュー4 + ブラフ4 を毎回保証 (100 試行)', () => {
    for (let t = 0; t < 100; t++) {
      const qs = buildBeginnerVs3Bet4BetQuestions(fullNodes());
      const value = qs.filter((q) => isValueRaise(q.strategy)).length;
      const bluff = qs.filter((q) => !isValueRaise(q.strategy) && isBluffOrSemiBluffRaise(q.strategy, topPct(q.hand))).length;
      expect(value).toBe(VALUE_QUOTA);
      expect(bluff).toBe(BLUFF_QUOTA);
    }
  });

  it('vs3bet:vs4bet = 12:8 で両シナリオ必ず出題 (100 試行)', () => {
    for (let t = 0; t < 100; t++) {
      const qs = buildBeginnerVs3Bet4BetQuestions(fullNodes());
      expect(qs.filter((q) => q.kind === 'vs3bet')).toHaveLength(VS3BET_TARGET);
      expect(qs.filter((q) => q.kind === 'vs4bet')).toHaveLength(VS4BET_TARGET);
    }
  });

  it('各問 EV<=40 / 非混合。vs3bet は AA・KK なし', () => {
    const qs = buildBeginnerVs3Bet4BetQuestions(fullNodes());
    for (const q of qs) {
      expect(isEligibleByEvThreshold(q.hand)).toBe(true);
      expect(isAllMixedStrategy(q.strategy)).toBe(false);
      if (q.kind === 'vs3bet') expect(q.hand === 'AA' || q.hand === 'KK').toBe(false);
    }
  });

  it('nodeFile は kind に応じた正しいパターン、hero は vs3bet=opener / vs4bet=threebettor', () => {
    const qs = buildBeginnerVs3Bet4BetQuestions(fullNodes());
    for (const q of qs) {
      if (q.kind === 'vs3bet') {
        expect(q.nodeFile).toBe(vs3betNodeFile(q.opener, q.threebettor));
        expect(q.hero).toBe(q.opener);
      } else {
        expect(q.nodeFile).toBe(vs4betNodeFile(q.opener, q.threebettor));
        expect(q.hero).toBe(q.threebettor);
      }
    }
  });

  it('同一ノードのハンド重複なし', () => {
    const qs = buildBeginnerVs3Bet4BetQuestions(fullNodes());
    const seen = new Set<string>();
    for (const q of qs) {
      const k = `${q.nodeFile}:${q.hand}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

describe('node file helpers', () => {
  it('vs3bet = {opener}r_{3bettor}r_{opener}.json', () => {
    expect(vs3betNodeFile('UTG', 'BB')).toBe('utgr_bbr_utg.json');
  });
  it('vs4bet = {opener}r_{3bettor}r_{opener}r_{3bettor}.json', () => {
    expect(vs4betNodeFile('UTG', 'BB')).toBe('utgr_bbr_utgr_bb.json');
    const kinds: VsRaiseKind[] = ['vs3bet', 'vs4bet'];
    expect(kinds).toHaveLength(2);
  });
});
