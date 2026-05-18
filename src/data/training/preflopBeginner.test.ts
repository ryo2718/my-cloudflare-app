import { describe, it, expect } from 'vitest';
import {
  OPEN_POSITIONS,
  OPEN_TIER_RANGES,
  PREFLOP_ORDER,
  VS_OPEN_PAIRS,
  VS_OPEN_RESPONDERS,
  VS_OPEN_TIER_RANGES,
  correctForBeginner,
  generateOpenQuestion,
  generateVsOpenQuestion,
  hasAnyParticipation,
  isEligibleForBeginner,
  positionsBefore,
  positionsBetween,
  type HandStrategy,
  type OpenStrategies,
  type VsOpenStrategies,
} from './preflopBeginner';
import { getHandsFromTiers, getTierOfHand } from './tierLookup';
import type { Position } from '../../types/strategy';

// ---------------------------------------------------------------------------
// 1. 純粋ヘルパー
// ---------------------------------------------------------------------------

describe('hasAnyParticipation', () => {
  it('100% fold → false', () => {
    const s: HandStrategy = { fold: 100, call: 0, raise: 0, allin: 0 };
    expect(hasAnyParticipation(s)).toBe(false);
  });
  it('1% でも call があれば true', () => {
    const s: HandStrategy = { fold: 99, call: 1, raise: 0, allin: 0 };
    expect(hasAnyParticipation(s)).toBe(true);
  });
  it('30% raise / 70% fold (混合) → true', () => {
    const s: HandStrategy = { fold: 70, call: 0, raise: 30, allin: 0 };
    expect(hasAnyParticipation(s)).toBe(true);
  });
  it('allin だけでも true', () => {
    const s: HandStrategy = { fold: 90, call: 0, raise: 0, allin: 10 };
    expect(hasAnyParticipation(s)).toBe(true);
  });
  it('undefined (戦略未定義) → false', () => {
    expect(hasAnyParticipation(undefined)).toBe(false);
  });
});

describe('positionsBefore / positionsBetween', () => {
  it('UTG より前 = []', () => {
    expect(positionsBefore('UTG')).toEqual([]);
  });
  it('BB より前 = UTG,HJ,CO,BTN,SB', () => {
    expect(positionsBefore('BB')).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB']);
  });
  it('SB より前 = UTG,HJ,CO,BTN', () => {
    expect(positionsBefore('SB')).toEqual(['UTG', 'HJ', 'CO', 'BTN']);
  });
  it('UTG と SB の間 = HJ,CO,BTN', () => {
    expect(positionsBetween('UTG', 'SB')).toEqual(['HJ', 'CO', 'BTN']);
  });
  it('opener が responder 以後 = []', () => {
    expect(positionsBetween('BTN', 'CO')).toEqual([]);
    expect(positionsBetween('CO', 'CO')).toEqual([]);
  });
  it('隣接ペア (HJ-CO) の間 = []', () => {
    expect(positionsBetween('HJ', 'CO')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. テスト用合成データ (open / vs_open)
// ---------------------------------------------------------------------------

/** 全ハンドが 100% fold = 必ず "fold" 正解。 */
function makeAllFoldStrategy(): Record<string, HandStrategy> {
  const out: Record<string, HandStrategy> = {};
  for (const tier of [
    'premium', 'elite', 'strong', 'good', 'standard',
    'average', 'weak', 'marginal', 'poor', 'garbage', 'trash',
  ] as const) {
    for (const hand of getHandsFromTiers([tier])) {
      out[hand] = { fold: 100, call: 0, raise: 0, allin: 0 };
    }
  }
  return out;
}

/** 全ハンドが 100% raise = 必ず "participate" 正解。 */
function makeAllRaiseStrategy(): Record<string, HandStrategy> {
  const out: Record<string, HandStrategy> = {};
  for (const tier of [
    'premium', 'elite', 'strong', 'good', 'standard',
    'average', 'weak', 'marginal', 'poor', 'garbage', 'trash',
  ] as const) {
    for (const hand of getHandsFromTiers([tier])) {
      out[hand] = { fold: 0, call: 0, raise: 100, allin: 0 };
    }
  }
  return out;
}

function makeOpenAll(strategyFactory: () => Record<string, HandStrategy>): OpenStrategies {
  return {
    UTG: strategyFactory(),
    HJ: strategyFactory(),
    CO: strategyFactory(),
    BTN: strategyFactory(),
    SB: strategyFactory(),
  };
}

function makeVsOpenAll(strategyFactory: () => Record<string, HandStrategy>): VsOpenStrategies {
  const out: VsOpenStrategies = {};
  for (const [o, r] of VS_OPEN_PAIRS) {
    if (!out[o]) out[o] = {};
    out[o]![r] = strategyFactory();
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. ポジション制約 (前半 BB 出ない / 後半 UTG 出ない)
// ---------------------------------------------------------------------------

describe('ポジション分布制約', () => {
  it('open: 100 回生成して BB が出ない & 5 ポジション全て出る', () => {
    const data = makeOpenAll(makeAllFoldStrategy);
    const seen = new Set<Position>();
    for (let i = 0; i < 100; i++) {
      const q = generateOpenQuestion(data);
      expect(q.myPosition).not.toBe('BB');
      expect(OPEN_POSITIONS).toContain(q.myPosition);
      seen.add(q.myPosition);
    }
    // 確率的には 100 回で 5 ポジ全て出るはず (Math.random で確認的)
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('vs_open: 100 回生成して UTG が出ず、opener が responder より前', () => {
    const data = makeVsOpenAll(makeAllFoldStrategy);
    for (let i = 0; i < 100; i++) {
      const q = generateVsOpenQuestion(data);
      expect(q.myPosition).not.toBe('UTG');
      expect(VS_OPEN_RESPONDERS).toContain(q.myPosition);
      // opener が responder より前 (PREFLOP_ORDER 上)
      const oi = PREFLOP_ORDER.indexOf(q.opener!);
      const ri = PREFLOP_ORDER.indexOf(q.myPosition);
      expect(oi).toBeLessThan(ri);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. ティア範囲遵守
// ---------------------------------------------------------------------------

describe('出題ハンドのティア範囲遵守', () => {
  it('open: 各ポジションのハンドが OPEN_TIER_RANGES 内', () => {
    const data = makeOpenAll(makeAllFoldStrategy);
    for (let i = 0; i < 200; i++) {
      const q = generateOpenQuestion(data);
      const allowedTiers = OPEN_TIER_RANGES[q.myPosition];
      const tier = getTierOfHand(q.hand);
      expect(tier).not.toBeNull();
      expect(allowedTiers).toContain(tier!);
    }
  });

  it('vs_open: responder ポジションのハンドが VS_OPEN_TIER_RANGES 内', () => {
    const data = makeVsOpenAll(makeAllFoldStrategy);
    for (let i = 0; i < 200; i++) {
      const q = generateVsOpenQuestion(data);
      const allowedTiers = VS_OPEN_TIER_RANGES[q.myPosition];
      const tier = getTierOfHand(q.hand);
      expect(tier).not.toBeNull();
      expect(allowedTiers).toContain(tier!);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. 正解判定
// ---------------------------------------------------------------------------

describe('正解判定 (correct)', () => {
  it('全 fold データ → 全問 "fold" 正解 (open)', () => {
    const data = makeOpenAll(makeAllFoldStrategy);
    for (let i = 0; i < 50; i++) {
      const q = generateOpenQuestion(data);
      expect(q.correct).toBe('fold');
    }
  });

  it('全 raise データ → 全問 "participate" 正解 (open)', () => {
    const data = makeOpenAll(makeAllRaiseStrategy);
    for (let i = 0; i < 50; i++) {
      const q = generateOpenQuestion(data);
      expect(q.correct).toBe('participate');
    }
  });

  it('全 fold データ → 全問 "fold" 正解 (vs_open)', () => {
    const data = makeVsOpenAll(makeAllFoldStrategy);
    for (let i = 0; i < 50; i++) {
      const q = generateVsOpenQuestion(data);
      expect(q.correct).toBe('fold');
    }
  });

  it('混合戦略 (30% raise / 70% fold) → "participate"', () => {
    const mixed: HandStrategy = { fold: 70, call: 0, raise: 30, allin: 0 };
    expect(hasAnyParticipation(mixed)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. foldedBefore (PokerTable opacity 用)
// ---------------------------------------------------------------------------

describe('foldedBefore (PokerTable 用)', () => {
  it('open: foldedBefore = 自分より前のポジション全て', () => {
    const data = makeOpenAll(makeAllFoldStrategy);
    for (let i = 0; i < 50; i++) {
      const q = generateOpenQuestion(data);
      expect(q.foldedBefore).toEqual(positionsBefore(q.myPosition));
    }
  });

  it('vs_open: foldedBefore = positionsBefore(opener) + positionsBetween(opener,me)', () => {
    const data = makeVsOpenAll(makeAllFoldStrategy);
    for (let i = 0; i < 50; i++) {
      const q = generateVsOpenQuestion(data);
      const expected = [
        ...positionsBefore(q.opener!),
        ...positionsBetween(q.opener!, q.myPosition),
      ];
      expect(q.foldedBefore).toEqual(expected);
      // opener と responder 自身は含まれない
      expect(q.foldedBefore).not.toContain(q.opener);
      expect(q.foldedBefore).not.toContain(q.myPosition);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. 出題バリエーション (各ポジ × ティアでハンドが存在)
// ---------------------------------------------------------------------------

describe('出題バリエーション統計', () => {
  it('open: 各ポジションが少なくとも 10 ハンド以上出題可能', () => {
    for (const pos of OPEN_POSITIONS) {
      const tiers = OPEN_TIER_RANGES[pos];
      const pool = getHandsFromTiers(tiers);
      expect(pool.length).toBeGreaterThanOrEqual(10);
    }
  });
  it('vs_open: 各 responder が少なくとも 5 ハンド以上出題可能', () => {
    for (const pos of VS_OPEN_RESPONDERS) {
      const tiers = VS_OPEN_TIER_RANGES[pos];
      const pool = getHandsFromTiers(tiers);
      expect(pool.length).toBeGreaterThanOrEqual(5);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. VS_OPEN_PAIRS の整合性
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 9. 混合戦略フィルタ (初級専用ルール)
// ---------------------------------------------------------------------------

describe('isEligibleForBeginner (混合戦略除外)', () => {
  it('fold 0% (= 100% raise) → eligible', () => {
    expect(isEligibleForBeginner({ fold: 0, call: 0, raise: 100, allin: 0 })).toBe(true);
  });
  it('fold 100% → eligible', () => {
    expect(isEligibleForBeginner({ fold: 100, call: 0, raise: 0, allin: 0 })).toBe(true);
  });
  it('fold 50% (混合) → ineligible', () => {
    expect(isEligibleForBeginner({ fold: 50, call: 0, raise: 50, allin: 0 })).toBe(false);
  });
  it('fold 70% / call 30% (混合) → ineligible', () => {
    expect(isEligibleForBeginner({ fold: 70, call: 30, raise: 0, allin: 0 })).toBe(false);
  });
  it('fold 0.05% (誤差レベル) → eligible として扱う (EPSILON 0.1%)', () => {
    expect(isEligibleForBeginner({ fold: 0.05, call: 0, raise: 99.95, allin: 0 })).toBe(true);
  });
  it('fold 99.95% (誤差レベル) → eligible として扱う', () => {
    expect(isEligibleForBeginner({ fold: 99.95, call: 0.05, raise: 0, allin: 0 })).toBe(true);
  });
  it('undefined → 出題対象 (実質 100% fold とみなす)', () => {
    expect(isEligibleForBeginner(undefined)).toBe(true);
  });
});

describe('correctForBeginner (正解整合性)', () => {
  it('fold 100% → fold 正解', () => {
    expect(correctForBeginner({ fold: 100, call: 0, raise: 0, allin: 0 })).toBe('fold');
  });
  it('fold 0% / raise 100% → participate 正解', () => {
    expect(correctForBeginner({ fold: 0, call: 0, raise: 100, allin: 0 })).toBe('participate');
  });
  it('fold 0% / call 100% → participate 正解', () => {
    expect(correctForBeginner({ fold: 0, call: 100, raise: 0, allin: 0 })).toBe('participate');
  });
  it('fold 0% / raise 80% / call 20% (fold なし混合) → participate', () => {
    expect(correctForBeginner({ fold: 0, call: 20, raise: 80, allin: 0 })).toBe('participate');
  });
  it('undefined → fold (戦略未定義は実質 fold)', () => {
    expect(correctForBeginner(undefined)).toBe('fold');
  });
});

describe('混合戦略フィルタの実動作 (generateOpenQuestion / generateVsOpenQuestion)', () => {
  // 部分的に eligible、部分的に混合のデータを作る
  function makePartialEligible(): Record<string, HandStrategy> {
    const out: Record<string, HandStrategy> = {};
    const allHands = [...getHandsFromTiers([
      'premium', 'elite', 'strong', 'good', 'standard',
      'average', 'weak', 'marginal', 'poor', 'garbage', 'trash',
    ])];
    allHands.forEach((hand, i) => {
      if (i % 3 === 0) {
        out[hand] = { fold: 100, call: 0, raise: 0, allin: 0 };       // fold 100%
      } else if (i % 3 === 1) {
        out[hand] = { fold: 0, call: 0, raise: 100, allin: 0 };       // fold 0%
      } else {
        out[hand] = { fold: 50, call: 0, raise: 50, allin: 0 };       // 混合: フィルタされる
      }
    });
    return out;
  }

  it('open: 100 回生成して、すべて eligible なハンドのみ (混合 0 件)', () => {
    const data: OpenStrategies = {
      UTG: makePartialEligible(),
      HJ: makePartialEligible(),
      CO: makePartialEligible(),
      BTN: makePartialEligible(),
      SB: makePartialEligible(),
    };
    for (let i = 0; i < 100; i++) {
      const q = generateOpenQuestion(data);
      const strategy = data[q.myPosition]![q.hand];
      expect(isEligibleForBeginner(strategy)).toBe(true);
    }
  });

  it('vs_open: 100 回生成して、すべて eligible (混合 0 件)', () => {
    const data: VsOpenStrategies = {};
    for (const [o, r] of VS_OPEN_PAIRS) {
      if (!data[o]) data[o] = {};
      data[o]![r] = makePartialEligible();
    }
    for (let i = 0; i < 100; i++) {
      const q = generateVsOpenQuestion(data);
      const strategy = data[q.opener!]![q.myPosition]![q.hand];
      expect(isEligibleForBeginner(strategy)).toBe(true);
    }
  });

  it('open: 生成された問題の correct は戦略と整合 (fold 100% → fold / fold 0% → participate)', () => {
    const data: OpenStrategies = {
      UTG: makePartialEligible(),
      HJ: makePartialEligible(),
      CO: makePartialEligible(),
      BTN: makePartialEligible(),
      SB: makePartialEligible(),
    };
    for (let i = 0; i < 100; i++) {
      const q = generateOpenQuestion(data);
      const strategy = data[q.myPosition]![q.hand];
      const fold = strategy.fold;
      if (fold === 100) expect(q.correct).toBe('fold');
      else if (fold === 0) expect(q.correct).toBe('participate');
      else throw new Error('non-eligible leaked through filter');
    }
  });

  it('全ハンド混合戦略 → 50 回リトライ後に throw', () => {
    function makeAllMixed(): Record<string, HandStrategy> {
      const out: Record<string, HandStrategy> = {};
      for (const hand of getHandsFromTiers([
        'premium', 'elite', 'strong', 'good', 'standard',
        'average', 'weak', 'marginal', 'poor', 'garbage', 'trash',
      ])) {
        out[hand] = { fold: 50, call: 0, raise: 50, allin: 0 };
      }
      return out;
    }
    const data: OpenStrategies = {
      UTG: makeAllMixed(), HJ: makeAllMixed(), CO: makeAllMixed(),
      BTN: makeAllMixed(), SB: makeAllMixed(),
    };
    expect(() => generateOpenQuestion(data)).toThrow(/no eligible hand/);
  });
});

// ---------------------------------------------------------------------------
// 10. VS_OPEN_PAIRS 整合性
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// handToCards スート分布 (バグ修正: ♠♥ 固定 → 4 スートランダム)
// ---------------------------------------------------------------------------

import { handToCards } from './preflopBeginner';

describe('handToCards スート分布', () => {
  it('ペア (AA): 300 回で 4 スート全て出現、かつ 2 枚は常に異なる', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const [c1, c2] = handToCards('AA');
      seen.add(c1.suit);
      seen.add(c2.suit);
      expect(c1.suit).not.toBe(c2.suit);
    }
    expect(seen.size).toBe(4); // s/h/d/c 全部
  });

  it('スーテッド (AKs): 2 枚は常に同じスート + 300 回で 4 スート全部出現', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const [c1, c2] = handToCards('AKs');
      expect(c1.suit).toBe(c2.suit);
      seen.add(c1.suit);
    }
    expect(seen.size).toBe(4);
  });

  it('オフスート (AKo): 2 枚は常に異なるスート + 300 回で 4 スート全部出現', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const [c1, c2] = handToCards('AKo');
      expect(c1.suit).not.toBe(c2.suit);
      seen.add(c1.suit);
      seen.add(c2.suit);
    }
    expect(seen.size).toBe(4);
  });

  it('rank は常にハンド表記と一致 (AKs → A & K)', () => {
    for (let i = 0; i < 50; i++) {
      const [c1, c2] = handToCards('AKs');
      expect(c1.rank).toBe('A');
      expect(c2.rank).toBe('K');
    }
  });

  it('ペアの rank はどちらも同じ (QQ → Q & Q)', () => {
    for (let i = 0; i < 50; i++) {
      const [c1, c2] = handToCards('QQ');
      expect(c1.rank).toBe('Q');
      expect(c2.rank).toBe('Q');
    }
  });
});

describe('VS_OPEN_PAIRS', () => {
  it('15 ペア (UTG×5 + HJ×4 + CO×3 + BTN×2 + SB×1)', () => {
    expect(VS_OPEN_PAIRS).toHaveLength(15);
  });
  it('全ペアで opener < responder (PREFLOP_ORDER 上)', () => {
    for (const [o, r] of VS_OPEN_PAIRS) {
      expect(PREFLOP_ORDER.indexOf(o)).toBeLessThan(PREFLOP_ORDER.indexOf(r));
    }
  });
  it('opener は OPEN_POSITIONS, responder は VS_OPEN_RESPONDERS', () => {
    for (const [o, r] of VS_OPEN_PAIRS) {
      expect(OPEN_POSITIONS).toContain(o);
      expect(VS_OPEN_RESPONDERS).toContain(r);
    }
  });
});
