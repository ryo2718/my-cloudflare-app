// フロップ中級CB: 出題生成 (30問構成・配分・選択肢) + ベットサイズ丸め + 複数選択採点。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFlopCbQuestions,
  flopCbBucket,
  scoreFlopCb,
  flopCbScenarioLabel,
  type FlopCbData,
  type FlopCbQuestion,
  type FlopCbStrat,
  FLOP_CB_COUNT,
  FLOP_CB_MAX_SCORE,
  FLOP_CB_CLEAR_SCORE,
} from './flopIntermediateCb';

const DATA: FlopCbData = JSON.parse(
  readFileSync('public/data/flop/flop_intermediate_cb_v1.json', 'utf8'),
);

function counts(qs: FlopCbQuestion[]) {
  return {
    total: qs.length,
    SRP: qs.filter((q) => q.potCat === 'SRP').length,
    '3bet': qs.filter((q) => q.potCat === '3bet').length,
    '4bet5bet': qs.filter((q) => q.potCat === '4bet5bet').length,
  };
}

describe('フロップ中級CB 出題生成', () => {
  it('全30問・SRP17/3bp8/4bp5bp5 (50セッション安定)', () => {
    for (let s = 0; s < 50; s++) {
      const c = counts(buildFlopCbQuestions(DATA));
      expect(c.total).toBe(FLOP_CB_COUNT);
      expect(c.SRP).toBe(17);
      expect(c['3bet']).toBe(8);
      expect(c['4bet5bet']).toBe(5);
    }
  });

  it('ポット種別ごとの選択肢が仕様どおり', () => {
    for (const q of buildFlopCbQuestions(DATA)) {
      if (q.potCat === 'SRP') expect(q.choices).toEqual(['check', '33', '50', '75', '125']);
      else if (q.potCat === '3bet') expect(q.choices).toEqual(['check', '20', '33', '50', '75', '125', 'ALLIN']);
      else expect(q.choices).toEqual(['check', '10', '25', '33', '50', 'ALLIN']);
      expect(q.board).toHaveLength(3);
    }
  });

  it('同一 variant:board は重複しない', () => {
    const qs = buildFlopCbQuestions(DATA);
    const keys = qs.map((q) => `${q.variant}:${q.board.map((c) => c.rank + c.suit).join('')}`);
    expect(new Set(keys).size).toBe(qs.length);
  });

  it('各問の strat キーは選択肢の範囲内のみ (丸め適用後)', () => {
    for (const q of buildFlopCbQuestions(DATA)) {
      for (const k of Object.keys(q.strat)) expect(q.choices).toContain(k);
    }
  });
});

describe('データの丸め (3bp: 10/25→20, 100/150→125 / 4bp: 50超→ALLIN)', () => {
  it('3bet ボードに 10/25/100/150 のバケットは存在しない', () => {
    for (const b of DATA.pots['3bet']) {
      for (const k of Object.keys(b.strat)) {
        expect(['10', '25', '100', '150']).not.toContain(k);
      }
    }
  });
  it('4bet5bet ボードに 75/100/125 のバケットは存在しない (50超は ALLIN)', () => {
    for (const b of DATA.pots['4bet5bet']) {
      for (const k of Object.keys(b.strat)) {
        expect(['75', '100', '125', '150']).not.toContain(k);
      }
    }
  });
});

describe('flopCbBucket 丸めルール', () => {
  it('SRP: 33/50/75/125 最近傍', () => {
    expect(flopCbBucket('SRP', 33)).toBe('33');
    expect(flopCbBucket('SRP', 125)).toBe('125');
    expect(flopCbBucket('SRP', undefined as unknown as number, true)).toBe('125'); // RAI→125
  });
  it('3bet: 10/25→20, 100/150→125', () => {
    expect(flopCbBucket('3bet', 10)).toBe('20');
    expect(flopCbBucket('3bet', 25)).toBe('20');
    expect(flopCbBucket('3bet', 100)).toBe('125');
    expect(flopCbBucket('3bet', 150)).toBe('125');
    expect(flopCbBucket('3bet', 33)).toBe('33');
    expect(flopCbBucket('3bet', 0, true)).toBe('ALLIN');
  });
  it('4bet5bet: 50超→ALLIN, それ以外は 10/25/33/50 最近傍', () => {
    expect(flopCbBucket('4bet5bet', 10)).toBe('10');
    expect(flopCbBucket('4bet5bet', 50)).toBe('50');
    expect(flopCbBucket('4bet5bet', 75)).toBe('ALLIN');
    expect(flopCbBucket('4bet5bet', 100)).toBe('ALLIN');
    expect(flopCbBucket('4bet5bet', 0, true)).toBe('ALLIN');
  });
});

describe('複数選択採点 (プリフロ中級方式・1問2pt)', () => {
  // strat は 0..1。bandScore: <10%→0 / <20%→0.5 / <70%→1 / >=70%→2。
  const strat: FlopCbStrat = { check: 0.1, '33': 0.6, '50': 0.25, '75': 0.05 };

  it('満点(2): 主要アクションを過不足なく選ぶ', () => {
    // theoreticalMax = floor(band(0.1)=0.5 + band(0.6)=1 + band(0.25)=1 + band(0.05<5%? =5% は対象, band(0.05)=0) ) ... 0.05 は >=5% で band=0
    // = floor(0.5+1+1+0) = 2。 全部 (check,33,50,75) 選ぶと raw= floor(0.5+1+1+0)=2 → final=round(2/2*2)=2
    expect(scoreFlopCb(strat, { selections: ['check', '33', '50', '75'], timedOut: false }).finalScore).toBe(2);
  });
  it('部分点(1): 一部だけ選ぶ', () => {
    // 33 のみ: raw=floor(1)=1, max=2 → round(1/2*2)=1
    expect(scoreFlopCb(strat, { selections: ['33'], timedOut: false }).finalScore).toBe(1);
  });
  it('5%未満を選ぶと即-1', () => {
    const s: FlopCbStrat = { check: 0.5, '33': 0.5, '50': 0.02 };
    expect(scoreFlopCb(s, { selections: ['50'], timedOut: false }).finalScore).toBe(-1);
  });
  it('70%以上を取りこぼすと即-1', () => {
    const s: FlopCbStrat = { check: 0.8, '33': 0.2 };
    expect(scoreFlopCb(s, { selections: ['33'], timedOut: false }).finalScore).toBe(-1);
  });
  it('無回答=0 / 時間切れ=-1', () => {
    expect(scoreFlopCb(strat, { selections: [], timedOut: false }).finalScore).toBe(0);
    expect(scoreFlopCb(strat, { selections: [], timedOut: true }).finalScore).toBe(-1);
  });

  describe('採点緩和: 主要アクション(>=20%)だけで満点、少数サイズの取りこぼしは減点しない', () => {
    it('主要 (check45/33→45) だけ選べば満点。少数 (50→10%) は不要', () => {
      const s: FlopCbStrat = { check: 0.45, '33': 0.45, '50': 0.1 };
      expect(scoreFlopCb(s, { selections: ['check', '33'], timedOut: false }).finalScore).toBe(2);
      // 少数を足しても満点のまま (頭打ち)
      expect(scoreFlopCb(s, { selections: ['check', '33', '50'], timedOut: false }).finalScore).toBe(2);
    });
    it('理論最高点は >=20% のアクションのみで算出', () => {
      const s: FlopCbStrat = { check: 0.5, '33': 0.4, '50': 0.1 };
      // check(0.5,band1)+33(0.4,band1)=2 (50 は <20% で除外)
      expect(scoreFlopCb(s, { selections: ['check', '33'], timedOut: false }).theoreticalMax).toBe(2);
    });
  });

  describe('多数派サイド必須 (毎回チェック対策)', () => {
    it('ベット主体 (合計>チェック) でチェックのみは -1', () => {
      const s: FlopCbStrat = { check: 0.3, '33': 0.4, '50': 0.3 }; // bet合計0.7 > check0.3
      expect(scoreFlopCb(s, { selections: ['check'], timedOut: false }).finalScore).toBe(-1);
    });
    it('ベット主体でベットを選べば -1 ではない', () => {
      const s: FlopCbStrat = { check: 0.3, '33': 0.4, '50': 0.3 };
      expect(scoreFlopCb(s, { selections: ['33'], timedOut: false }).finalScore).toBeGreaterThanOrEqual(0);
    });
    it('チェック主体 (チェック>ベット合計) ならチェックのみで部分点が残る', () => {
      const s: FlopCbStrat = { check: 0.6, '33': 0.3, '50': 0.1 }; // check0.6 > bet0.4
      expect(scoreFlopCb(s, { selections: ['check'], timedOut: false }).finalScore).toBeGreaterThanOrEqual(1);
    });
    it('チェック主体でチェック未選択 (ベットのみ) は -1', () => {
      const s: FlopCbStrat = { check: 0.6, '33': 0.25, '50': 0.15 };
      expect(scoreFlopCb(s, { selections: ['33'], timedOut: false }).finalScore).toBe(-1);
    });
  });
  it('満点・クリア定数 (30問×2pt=60、クリア=54)', () => {
    expect(FLOP_CB_MAX_SCORE).toBe(60);
    expect(FLOP_CB_CLEAR_SCORE).toBe(54);
  });
});

describe('flopCbScenarioLabel', () => {
  it('ポット種別タグ', () => {
    expect(flopCbScenarioLabel({ pot: 'SRP', hero: 'CO', villain: 'BTN' })).toBe('srp CO vs BTN');
    expect(flopCbScenarioLabel({ pot: '3bet', hero: 'BB', villain: 'BTN' })).toBe('3bp BB vs BTN');
    expect(flopCbScenarioLabel({ pot: '4bet', hero: 'CO', villain: 'BTN' })).toBe('4bp CO vs BTN');
    expect(flopCbScenarioLabel({ pot: '5bet', hero: 'SB', villain: 'CO' })).toBe('5bp SB vs CO');
  });
});
