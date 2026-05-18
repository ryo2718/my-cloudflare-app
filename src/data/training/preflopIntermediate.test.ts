import { describe, it, expect } from 'vitest';
import {
  ACTIONS,
  countMajorStrategies,
  eligibleOpenersFromData,
  generateIntermediateQuestion,
  getTheoreticalMaxScore,
  isHandEligible,
  isInstantPenalty,
  isMonotonicRange,
  normalize,
  scoreAnswer,
  scoreTimeout,
  VS_OPEN_OPENERS,
  type Action,
  type VsOpenBbStrategies,
} from './preflopIntermediate';
import type { HandStrategy } from './preflopBeginner';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function s(allin: number, raise: number, call: number, fold: number): HandStrategy {
  return { allin, raise, call, fold };
}

// ---------------------------------------------------------------------------
// フィルタ
// ---------------------------------------------------------------------------

describe('countMajorStrategies (>=20% を主要と判定)', () => {
  it('全戦略 20% 未満 → 0', () => {
    expect(countMajorStrategies(s(15, 15, 15, 15))).toBe(0);
  });
  it('1 個だけ 20%+ → 1', () => {
    expect(countMajorStrategies(s(0, 30, 0, 70))).toBe(2);
  });
  it('3 つが 20%+ → 3', () => {
    expect(countMajorStrategies(s(0, 30, 40, 30))).toBe(3);
  });
  it('全アクション 25% → 4', () => {
    expect(countMajorStrategies(s(25, 25, 25, 25))).toBe(4);
  });
});

describe('isHandEligible (出題対象判定)', () => {
  it('ティア表に存在する AA で raise 100% → 明確すぎて除外', () => {
    expect(isHandEligible('AA', s(0, 100, 0, 0))).toBe(false);
  });
  it('KK = {ai 5, raise 90, call 5, fold 0} → 出題対象', () => {
    expect(isHandEligible('KK', s(5, 90, 5, 0))).toBe(true);
  });
  it('QQ = {ai 10, raise 75, call 15, fold 0} → 出題対象', () => {
    expect(isHandEligible('QQ', s(10, 75, 15, 0))).toBe(true);
  });
  it('主要戦略 0 個 (全 20% 未満) → 除外', () => {
    expect(isHandEligible('22', s(15, 15, 15, 15))).toBe(false);
  });
  it('未定義戦略 → 除外', () => {
    expect(isHandEligible('AA', undefined)).toBe(false);
  });
});

describe('isMonotonicRange (全ハンド同一戦略レンジ判定)', () => {
  it('全ハンド 100% fold → monotonic', () => {
    const data = {
      AA: s(0, 0, 0, 100),
      KK: s(0, 0, 0, 100),
      AKs: s(0, 0, 0, 100),
    };
    expect(isMonotonicRange(data)).toBe(true);
  });
  it('1 ハンドでも違えば → false', () => {
    const data = {
      AA: s(0, 100, 0, 0),
      KK: s(0, 0, 0, 100),
    };
    expect(isMonotonicRange(data)).toBe(false);
  });
  it('空レンジ → monotonic (出題対象外扱い)', () => {
    expect(isMonotonicRange({})).toBe(true);
  });
});

describe('eligibleOpenersFromData', () => {
  it('全 opener が monotonic レンジ → 空配列', () => {
    const data: VsOpenBbStrategies = {};
    for (const op of VS_OPEN_OPENERS) {
      data[op] = { AA: s(0, 0, 0, 100), KK: s(0, 0, 0, 100) };
    }
    expect(eligibleOpenersFromData(data)).toEqual([]);
  });
  it('一部 opener だけ非 monotonic → その opener のみ', () => {
    const data: VsOpenBbStrategies = {
      UTG: { AA: s(0, 100, 0, 0), KK: s(0, 100, 0, 0) }, // monotonic
      HJ: { AA: s(0, 80, 20, 0), KK: s(0, 50, 50, 0) }, // 非 monotonic
    };
    expect(eligibleOpenersFromData(data)).toEqual(['HJ']);
  });
});

// ---------------------------------------------------------------------------
// 採点ロジック (仕様サンプル準拠)
// ---------------------------------------------------------------------------

describe('isInstantPenalty (<5% 戦略選択で即-1pt)', () => {
  it('fold 0% を選んだら true', () => {
    expect(isInstantPenalty(s(5, 90, 5, 0), ['raise', 'fold'])).toBe(true);
  });
  it('全選択が >=5% → false', () => {
    expect(isInstantPenalty(s(5, 90, 5, 0), ['raise', 'allin', 'call'])).toBe(false);
  });
  it('空選択 → false (即-1pt 判定はかからない)', () => {
    expect(isInstantPenalty(s(0, 100, 0, 0), [])).toBe(false);
  });
});

describe('getTheoreticalMaxScore', () => {
  it('KK {5,90,5,0} → 2 (90% → 2、5/5/0 は <10% で 0 or 除外)', () => {
    expect(getTheoreticalMaxScore(s(5, 90, 5, 0))).toBe(2);
  });
  it('QQ {10,75,15,0} → 3 (75% → 2, 10% → 0.5, 15% → 0.5 = 3.0)', () => {
    expect(getTheoreticalMaxScore(s(10, 75, 15, 0))).toBe(3);
  });
  it('JJ {0,60,30,10} → 2 (60+30 → 1+1=2, 10% → 0.5, ai 除外 = 2.5 → floor=2)', () => {
    expect(getTheoreticalMaxScore(s(0, 60, 30, 10))).toBe(2);
  });
  it('TT {0,40,42,18} → 2 (1+1+0.5=2.5 → floor=2)', () => {
    expect(getTheoreticalMaxScore(s(0, 40, 42, 18))).toBe(2);
  });
  it('88 {0,30,40,30} → 3 (1+1+1=3)', () => {
    expect(getTheoreticalMaxScore(s(0, 30, 40, 30))).toBe(3);
  });
  it('A5s {25,0,55,20} → 3 (1+1+1=3, raise 0% は除外)', () => {
    expect(getTheoreticalMaxScore(s(25, 0, 55, 20))).toBe(3);
  });
});

describe('normalize (rawScore / max * 2 → round)', () => {
  it('max=0 → 0 (ゼロ除算回避)', () => {
    expect(normalize(0, 0)).toBe(0);
  });
  it('rawScore=max → 2', () => {
    expect(normalize(3, 3)).toBe(2);
  });
  it('rawScore=2/3 → round(2/3*2) = round(1.33) = 1', () => {
    expect(normalize(2, 3)).toBe(1);
  });
  it('rawScore=1/3 → round(1/3*2) = round(0.67) = 1', () => {
    expect(normalize(1, 3)).toBe(1);
  });
  it('負スコアはそのまま通過しない (caller が -1 を返す前提)', () => {
    // normalize 単体では負も扱える: round(-1/2*2) = -1
    expect(normalize(-1, 2)).toBe(-1);
  });
});

describe('scoreAnswer (仕様サンプル)', () => {
  it('サンプル2 KK: raise のみ → final=2', () => {
    const r = scoreAnswer(s(5, 90, 5, 0), ['raise']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(2);
  });
  it('サンプル2 KK: raise+ai → final=2 (rawScore=2+0=2)', () => {
    const r = scoreAnswer(s(5, 90, 5, 0), ['raise', 'allin']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(2);
  });
  it('サンプル2 KK: raise+ai+call → final=2', () => {
    const r = scoreAnswer(s(5, 90, 5, 0), ['raise', 'allin', 'call']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(2);
  });
  it('サンプル2 KK: raise+fold → fold 0% で 即-1', () => {
    const r = scoreAnswer(s(5, 90, 5, 0), ['raise', 'fold']);
    expect(r.finalScore).toBe(-1);
    expect(r.rawScore).toBe(-1);
  });

  it('サンプル3 QQ: raise+ai+call → final=2 (rawScore=3, max=3)', () => {
    const r = scoreAnswer(s(10, 75, 15, 0), ['raise', 'allin', 'call']);
    expect(r.rawScore).toBe(3);
    expect(r.finalScore).toBe(2);
  });
  it('サンプル3 QQ: raise+ai → rawScore=floor(2+0.5)=2, final=round(2/3*2)=1', () => {
    const r = scoreAnswer(s(10, 75, 15, 0), ['raise', 'allin']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(1);
  });
  it('サンプル3 QQ: raise のみ → rawScore=2, final=1', () => {
    const r = scoreAnswer(s(10, 75, 15, 0), ['raise']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(1);
  });
  it('サンプル3 QQ: fold 含む → 即-1 (fold 0%)', () => {
    const r = scoreAnswer(s(10, 75, 15, 0), ['raise', 'fold']);
    expect(r.finalScore).toBe(-1);
  });

  it('サンプル4 JJ: raise+call+fold → rawScore=floor(1+1+0.5)=2, final=2 (max=2)', () => {
    const r = scoreAnswer(s(0, 60, 30, 10), ['raise', 'call', 'fold']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(2);
  });
  it('サンプル4 JJ: raise+call → rawScore=2, final=2', () => {
    const r = scoreAnswer(s(0, 60, 30, 10), ['raise', 'call']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(2);
  });
  it('サンプル4 JJ: raise のみ → rawScore=1, final=round(1/2*2)=1', () => {
    const r = scoreAnswer(s(0, 60, 30, 10), ['raise']);
    expect(r.rawScore).toBe(1);
    expect(r.finalScore).toBe(1);
  });
  it('サンプル4 JJ: ai 含む → ai 0% で 即-1', () => {
    const r = scoreAnswer(s(0, 60, 30, 10), ['raise', 'allin']);
    expect(r.finalScore).toBe(-1);
  });

  it('サンプル5 TT: raise+call+fold → rawScore=2 (1+1+0.5 floor), final=2 (max=2)', () => {
    const r = scoreAnswer(s(0, 40, 42, 18), ['raise', 'call', 'fold']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(2);
  });

  it('サンプル6 88: raise+call+fold → rawScore=3, final=2 (max=3)', () => {
    const r = scoreAnswer(s(0, 30, 40, 30), ['raise', 'call', 'fold']);
    expect(r.rawScore).toBe(3);
    expect(r.finalScore).toBe(2);
  });
  it('サンプル6 88: raise+call → rawScore=2, final=round(2/3*2)=1', () => {
    const r = scoreAnswer(s(0, 30, 40, 30), ['raise', 'call']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(1);
  });
  it('サンプル6 88: raise のみ → rawScore=1, final=round(1/3*2)=1', () => {
    const r = scoreAnswer(s(0, 30, 40, 30), ['raise']);
    expect(r.rawScore).toBe(1);
    expect(r.finalScore).toBe(1);
  });

  it('サンプル7 A5s: ai+call+fold → rawScore=3, final=2 (max=3)', () => {
    const r = scoreAnswer(s(25, 0, 55, 20), ['allin', 'call', 'fold']);
    expect(r.rawScore).toBe(3);
    expect(r.finalScore).toBe(2);
  });
  it('サンプル7 A5s: call+fold → rawScore=2, final=round(2/3*2)=1', () => {
    const r = scoreAnswer(s(25, 0, 55, 20), ['call', 'fold']);
    expect(r.rawScore).toBe(2);
    expect(r.finalScore).toBe(1);
  });
  it('サンプル7 A5s: raise 含む → raise 0% で 即-1', () => {
    const r = scoreAnswer(s(25, 0, 55, 20), ['call', 'raise']);
    expect(r.finalScore).toBe(-1);
  });

  it('何も選ばない (selections=[]) → finalScore=0', () => {
    const r = scoreAnswer(s(5, 90, 5, 0), []);
    expect(r.finalScore).toBe(0);
    expect(r.rawScore).toBe(0);
  });
});

describe('scoreTimeout (時間切れ -1pt 固定)', () => {
  it('finalScore=-1, rawScore=-1', () => {
    const r = scoreTimeout(s(0, 60, 30, 10));
    expect(r.finalScore).toBe(-1);
    expect(r.rawScore).toBe(-1);
    expect(r.theoreticalMax).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// バンド境界の境界値テスト
// ---------------------------------------------------------------------------

describe('採点バンドの境界値', () => {
  it('freq=5% → 0pt (バンド最下端は 0)', () => {
    const r = scoreAnswer(s(0, 5, 95, 0), ['raise']);
    expect(r.rawScore).toBe(0); // bandScore(5) = 0
  });
  it('freq=10% → 0.5pt (バンド境界、下側含む)', () => {
    // raise=10, call=90 → 選んで raise: rawScore=floor(0.5)=0, max=floor(0.5+2)=2 → final=0
    const r = scoreAnswer(s(0, 10, 90, 0), ['raise']);
    expect(r.rawScore).toBe(0); // 0.5 → floor = 0
  });
  it('freq=20% → 1pt', () => {
    const r = scoreAnswer(s(0, 20, 80, 0), ['raise']);
    expect(r.rawScore).toBe(1);
  });
  it('freq=70% → 2pt', () => {
    const r = scoreAnswer(s(0, 70, 30, 0), ['raise']);
    expect(r.rawScore).toBe(2);
  });
  it('freq=69.999% → 1pt (70% 未満)', () => {
    const r = scoreAnswer(s(0, 69.999, 30.001, 0), ['raise']);
    expect(r.rawScore).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 出題生成統計
// ---------------------------------------------------------------------------

describe('generateIntermediateQuestion (合成データで分布検証)', () => {
  function mkData(): VsOpenBbStrategies {
    // 数ハンドだけ eligible にしたデータ
    const eligible: Record<string, HandStrategy> = {
      KK: s(5, 90, 5, 0),
      QQ: s(10, 75, 15, 0),
      JJ: s(0, 60, 30, 10),
      TT: s(0, 40, 42, 18),
      '88': s(0, 30, 40, 30),
      A5s: s(25, 0, 55, 20),
    };
    const data: VsOpenBbStrategies = {};
    for (const op of VS_OPEN_OPENERS) {
      data[op] = { ...eligible };
    }
    return data;
  }

  it('100 回生成して、myPosition=BB / opener が 5 種から選ばれる', () => {
    const data = mkData();
    const openers = new Set();
    for (let i = 0; i < 100; i++) {
      const q = generateIntermediateQuestion(data);
      expect(q.myPosition).toBe('BB');
      expect(q.scenario).toBe('vs_open_bb');
      expect(VS_OPEN_OPENERS).toContain(q.opener);
      openers.add(q.opener);
    }
    expect(openers.size).toBeGreaterThanOrEqual(3);
  });

  it('生成された問題のハンドは全て eligible', () => {
    const data = mkData();
    for (let i = 0; i < 100; i++) {
      const q = generateIntermediateQuestion(data);
      expect(isHandEligible(q.hand, q.strategy)).toBe(true);
    }
  });

  it('foldedBefore に opener と BB は含まれない', () => {
    const data = mkData();
    for (let i = 0; i < 50; i++) {
      const q = generateIntermediateQuestion(data);
      expect(q.foldedBefore).not.toContain(q.opener);
      expect(q.foldedBefore).not.toContain('BB');
    }
  });
});

// ---------------------------------------------------------------------------
// ACTIONS 整合性
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// シナリオ invariant: 全 20 問が vs_open_bb / myPosition=BB であること (初級混入バグ防止)
// ---------------------------------------------------------------------------

describe('中級ジェネレータ invariant', () => {
  function mkData(): VsOpenBbStrategies {
    const eligible: Record<string, HandStrategy> = {
      KK: s(5, 90, 5, 0),
      QQ: s(10, 75, 15, 0),
      JJ: s(0, 60, 30, 10),
      TT: s(0, 40, 42, 18),
      '88': s(0, 30, 40, 30),
      A5s: s(25, 0, 55, 20),
    };
    const data: VsOpenBbStrategies = {};
    for (const op of VS_OPEN_OPENERS) data[op] = { ...eligible };
    return data;
  }

  it('100 回生成しても scenario は常に "vs_open_bb"', () => {
    const data = mkData();
    for (let i = 0; i < 100; i++) {
      const q = generateIntermediateQuestion(data);
      expect(q.scenario).toBe('vs_open_bb');
    }
  });

  it('100 回生成しても myPosition は常に "BB" (初級の他ポジ問題が紛れ込まない)', () => {
    const data = mkData();
    for (let i = 0; i < 100; i++) {
      const q = generateIntermediateQuestion(data);
      expect(q.myPosition).toBe('BB');
    }
  });

  it('opener は常に 5 ポジション (UTG/HJ/CO/BTN/SB)、BB を含まない', () => {
    const data = mkData();
    for (let i = 0; i < 100; i++) {
      const q = generateIntermediateQuestion(data);
      expect(VS_OPEN_OPENERS).toContain(q.opener);
      expect(q.opener).not.toBe('BB');
    }
  });
});

describe('ACTIONS 配列', () => {
  it('順序は allin → raise → call → fold', () => {
    expect(ACTIONS).toEqual(['allin', 'raise', 'call', 'fold']);
  });
  it('各 Action が HandStrategy のキーと一致', () => {
    const strategy = s(10, 60, 20, 10);
    for (const a of ACTIONS) {
      const _: number = strategy[a as Action];
      expect(typeof _).toBe('number');
    }
  });
});
