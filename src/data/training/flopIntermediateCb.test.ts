// フロップ CB レンジベット: 出題生成 (CB SRP=SRP30 / CB 3BP=3bet21,4bet6,5bet3) + CB複数選択採点。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFlopRbQuestions,
  flopCbBucket,
  scoreFlopCb,
  scoreFlopRb,
  flopRbScenarioLabel,
  type FlopRbData,
  type FlopRbQuestion,
  type FlopCbStrat,
  FLOP_RB_COUNT,
  FLOP_RB_MAX_SCORE,
  FLOP_RB_CLEAR_SCORE,
} from './flopIntermediateCb';
import type { Card } from '../../types/card';

const DATA: FlopRbData = JSON.parse(readFileSync('public/data/flop/flop_rangebet_v1.json', 'utf8'));

const board = (): [Card, Card, Card] => [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 'd' },
  { rank: '2', suit: 'c' },
];

const dominant = (s: FlopCbStrat): string =>
  Object.entries(s).reduce((best, [k, v]) => (v > (s[best] ?? -1) ? k : best), '');

function counts(qs: FlopRbQuestion[]) {
  return {
    total: qs.length,
    srp: qs.filter((q) => q.pot === 'SRP').length,
    threebet: qs.filter((q) => q.pot === '3bet').length,
    fourbet: qs.filter((q) => q.pot === '4bet').length,
    fivebet: qs.filter((q) => q.pot === '5bet').length,
  };
}

describe('CB SRP (flop_cb_srp) 出題生成', () => {
  it('全30問・全て SRP (50セッション安定)', () => {
    for (let s = 0; s < 50; s++) {
      const c = counts(buildFlopRbQuestions(DATA, 'srp'));
      expect(c.total).toBe(FLOP_RB_COUNT);
      expect(c.srp).toBe(30);
      expect(c.threebet + c.fourbet + c.fivebet).toBe(0);
    }
  });

  it('選択肢は SRP のポット別 (check/33/50/75/125・ALLIN無し)・strat・似たボードを持つ', () => {
    for (const q of buildFlopRbQuestions(DATA, 'srp')) {
      expect(q.board).toHaveLength(3);
      expect(q.choices).toEqual(['check', '33', '50', '75', '125']);
      expect(Object.keys(q.strat).length).toBeGreaterThan(0);
      expect(q.similar.length).toBeGreaterThan(0);
      for (const sim of q.similar) expect(sim.board).toHaveLength(3);
    }
  });
});

describe('CB 3BP/4BP/5BP (flop_cb_3bp) 出題生成', () => {
  it('全30問・3bet21 / 4bet6 / 5bet3 (= 7:2:1) (50セッション安定)', () => {
    for (let s = 0; s < 50; s++) {
      const c = counts(buildFlopRbQuestions(DATA, '3bp'));
      expect(c.total).toBe(FLOP_RB_COUNT);
      expect(c.srp).toBe(0);
      expect(c.threebet).toBe(21);
      expect(c.fourbet).toBe(6);
      expect(c.fivebet).toBe(3);
    }
  });

  it('ポット別選択肢: 5bet は check/33/50/ALLIN、4bet は 125 を含まない', () => {
    for (const q of buildFlopRbQuestions(DATA, '3bp')) {
      if (q.pot === '5bet') expect(q.choices).toEqual(['check', '33', '50', 'ALLIN']);
      if (q.pot === '4bet') {
        expect(q.choices).toContain('ALLIN');
        expect(q.choices).not.toContain('125');
      }
    }
  });

  it('オールイン主体(ALLIN>=20%)局面が出題される (ショートスタックの学習機会)', () => {
    let withAllin = 0;
    for (let s = 0; s < 20; s++) {
      withAllin += buildFlopRbQuestions(DATA, '3bp').filter((q) => (q.strat.ALLIN ?? 0) >= 0.2).length;
    }
    expect(withAllin).toBeGreaterThan(0);
  });
});

describe('ドンク/BMCB (flop_donk_bmcb) 出題生成', () => {
  it('全30問・ドンク15 / BMCB15 (50セッション安定)', () => {
    for (let s = 0; s < 50; s++) {
      const qs = buildFlopRbQuestions(DATA, 'donkbmcb');
      expect(qs.length).toBe(FLOP_RB_COUNT);
      expect(qs.filter((q) => q.kind === 'donk').length).toBe(15);
      expect(qs.filter((q) => q.kind === 'bmcb').length).toBe(15);
    }
  });

  it('SRP/3bet ポットのみ (4bet/5bet を含まない)', () => {
    for (const q of buildFlopRbQuestions(DATA, 'donkbmcb')) {
      expect(['SRP', '3bet']).toContain(q.pot);
      expect(q.similar.length).toBeGreaterThan(0);
    }
  });

  it('kind に応じてシナリオラベルが prefix される', () => {
    for (const q of buildFlopRbQuestions(DATA, 'donkbmcb')) {
      const label = flopRbScenarioLabel(q);
      if (q.kind === 'donk') expect(label.startsWith('donk ')).toBe(true);
      if (q.kind === 'bmcb') expect(label.startsWith('bmcb ')).toBe(true);
    }
  });
});

describe('共通 出題性質 (全モード)', () => {
  for (const mode of ['srp', '3bp', 'donkbmcb'] as const) {
    it(`[${mode}] 似たボードは設問と酷似しない (同ランク多重集合・1枚違いを除外)`, () => {
      for (let s = 0; s < 20; s++) {
        for (const q of buildFlopRbQuestions(DATA, mode)) {
          const qr = q.board.map((c) => c.rank);
          for (const sim of q.similar) {
            const sr = sim.board.map((c) => c.rank);
            const shared = [...new Set(qr)].filter((r) => sr.includes(r)).length;
            expect(shared).toBeLessThan(2);
          }
        }
      }
    });

    it(`[${mode}] 支配サイズが偏らない (1セッション内で2種以上)`, () => {
      for (let s = 0; s < 20; s++) {
        const doms = new Set(buildFlopRbQuestions(DATA, mode).map((q) => dominant(q.strat)));
        expect(doms.size).toBeGreaterThanOrEqual(2);
      }
    });

    it(`[${mode}] hero ポジションが多様 (1強にならない)`, () => {
      const heroes = new Map<string, number>();
      for (let s = 0; s < 30; s++) {
        for (const q of buildFlopRbQuestions(DATA, mode)) heroes.set(q.hero, (heroes.get(q.hero) ?? 0) + 1);
      }
      const total = [...heroes.values()].reduce((a, b) => a + b, 0);
      const max = Math.max(...heroes.values());
      expect(max / total).toBeLessThan(0.6);
    });

    it(`[${mode}] 同一 variant:board は重複しない`, () => {
      const qs = buildFlopRbQuestions(DATA, mode);
      const keys = qs.map((q) => `${q.variant}:${q.board.map((c) => c.rank + c.suit).join('')}`);
      expect(new Set(keys).size).toBe(qs.length);
    });
  }

  it('満点/クリア定数 (30問×2pt=60、クリア=54)', () => {
    expect(FLOP_RB_COUNT).toBe(30);
    expect(FLOP_RB_MAX_SCORE).toBe(60);
    expect(FLOP_RB_CLEAR_SCORE).toBe(54);
  });
});

describe('flopCbBucket (サイズ丸め)', () => {
  it('33/50/75/125 最近傍、allin→ALLIN', () => {
    expect(flopCbBucket(33)).toBe('33');
    expect(flopCbBucket(75)).toBe('75');
    expect(flopCbBucket(60)).toBe('50');
    expect(flopCbBucket(0, true)).toBe('ALLIN');
  });
});

describe('CB問題 複数選択採点 (scoreFlopCb)', () => {
  const strat: FlopCbStrat = { check: 0.1, '33': 0.6, '50': 0.25, '75': 0.05 };
  it('主要アクションで満点(2)', () => {
    expect(scoreFlopCb(strat, ['33', '50']).finalScore).toBe(2);
  });
  it('5%未満を選ぶと -1', () => {
    expect(scoreFlopCb({ check: 0.5, '33': 0.5, '50': 0.02 }, ['50']).finalScore).toBe(-1);
  });
  it('70%以上の取りこぼしは -1', () => {
    expect(scoreFlopCb({ check: 0.8, '33': 0.2 }, ['33']).finalScore).toBe(-1);
  });
  it('多数派サイド(ベット主体)でチェックのみは -1', () => {
    expect(scoreFlopCb({ check: 0.3, '33': 0.4, '50': 0.3 }, ['check']).finalScore).toBe(-1);
  });
  it('無回答=0', () => {
    expect(scoreFlopCb(strat, []).finalScore).toBe(0);
  });
});

describe('scoreFlopRb (CB=複数選択)', () => {
  const cbQ: FlopRbQuestion = {
    id: 1, pot: 'SRP', kind: 'cb', variant: 'cor_btnc', hero: 'CO', villain: 'BTN',
    board: board(), choices: ['check', '33', '50', '75', '125'],
    strat: { check: 0.1, '33': 0.6, '50': 0.3 }, preflopActions: [], similar: [],
  };
  it('select で複数選択採点', () => {
    expect(scoreFlopRb(cbQ, { kind: 'select', selections: ['33', '50'] })).toBe(2);
  });
  it('無回答 (選択なし) は 0', () => {
    expect(scoreFlopRb(cbQ, { kind: 'select', selections: [] })).toBe(0);
  });
});

describe('flopRbScenarioLabel', () => {
  it('ポット種別タグ (srp/3bp/4bp/5bp)', () => {
    expect(flopRbScenarioLabel({ pot: 'SRP', hero: 'CO', villain: 'BTN' })).toBe('srp CO vs BTN');
    expect(flopRbScenarioLabel({ pot: '3bet', hero: 'UTG', villain: 'BTN' })).toBe('3bp UTG vs BTN');
    expect(flopRbScenarioLabel({ pot: '4bet', hero: 'CO', villain: 'BTN' })).toBe('4bp CO vs BTN');
    expect(flopRbScenarioLabel({ pot: '5bet', hero: 'BB', villain: 'BTN' })).toBe('5bp BB vs BTN');
  });
});
