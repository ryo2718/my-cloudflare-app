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
import { getClusterId } from './boardClusters';

const DATA: FlopRbData = JSON.parse(readFileSync('public/data/flop/flop_rangebet_v1.json', 'utf8'));

const board6 = (q: FlopRbQuestion): string => q.board.map((c) => c.rank + c.suit).join('');
const clusterId = (q: FlopRbQuestion): number | null => getClusterId(board6(q));
// 母集団 (flop_rangebet 収録ボードの exact 文字列集合)。
const CORPUS = new Set<string>();
for (const cat of Object.keys(DATA.cb ?? {})) for (const x of DATA.cb[cat as 'SRP']) CORPUS.add(x.board);
for (const x of DATA.donk ?? []) CORPUS.add(x.board);
for (const x of DATA.bmcb ?? []) CORPUS.add(x.board);

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
  it('全30問・3bet主体で 4bet/5bet も毎回必ず出る (意図的枠が pot 比率を保証, 50セッション)', () => {
    for (let s = 0; s < 50; s++) {
      const c = counts(buildFlopRbQuestions(DATA, '3bp'));
      expect(c.total).toBe(FLOP_RB_COUNT);
      expect(c.srp).toBe(0);
      // 意図的枠が pot 比率 (21:6:3) を N に按分 → 希少な 4bet/5bet も最低 1 問保証。
      expect(c.threebet).toBeGreaterThanOrEqual(1);
      expect(c.fourbet).toBeGreaterThanOrEqual(1);
      expect(c.fivebet).toBeGreaterThanOrEqual(1);
    }
  });

  it('ポット別選択肢: 5bet は check/33/50/ALLIN、4bet は ALLIN を含む', () => {
    // 4bet の 125(オーバーベット)有無はデータ依存。high-card 層化収録後は一部の
    // 4bet ボードで 125 が使われるため「含まない」は前提にしない (5bet の浅さは維持)。
    for (const q of buildFlopRbQuestions(DATA, '3bp')) {
      if (q.pot === '5bet') expect(q.choices).toEqual(['check', '33', '50', 'ALLIN']);
      if (q.pot === '4bet') {
        expect(q.choices).toContain('ALLIN');
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
  it('全30問・ドンク と BMCB が毎回両方出る (意図的枠が 1:1 を保証, 50セッション)', () => {
    for (let s = 0; s < 50; s++) {
      const qs = buildFlopRbQuestions(DATA, 'donkbmcb');
      expect(qs.length).toBe(FLOP_RB_COUNT);
      expect(qs.filter((q) => q.kind === 'donk').length).toBeGreaterThanOrEqual(1);
      expect(qs.filter((q) => q.kind === 'bmcb').length).toBeGreaterThanOrEqual(1);
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

    it(`[${mode}] 同一ボード(カード)は重複しない (マッチアップ違いも含む) / 30問揃う`, () => {
      for (let s = 0; s < 30; s++) {
        const qs = buildFlopRbQuestions(DATA, mode);
        expect(qs.length).toBe(FLOP_RB_COUNT);
        const boards = qs.map((q) => q.board.map((c) => c.rank + c.suit).join(''));
        expect(new Set(boards).size).toBe(qs.length);
      }
    });

    it(`[${mode}] ハイカード帯がロー偏りせず散らばる (クラスタ層化でテクスチャ網羅)`, () => {
      const RANKS = '23456789TJQKA';
      const bandOf = (q: FlopRbQuestion): string => {
        const top = Math.max(...q.board.map((c) => RANKS.indexOf(c.rank)));
        return top === 12 ? 'A' : top >= 8 ? 'broadway' : top >= 4 ? 'mid' : 'low';
      };
      const counts: Record<string, number> = { A: 0, broadway: 0, mid: 0, low: 0 };
      const SESS = 40;
      for (let s = 0; s < SESS; s++) {
        for (const q of buildFlopRbQuestions(DATA, mode)) counts[bandOf(q)] += 1;
      }
      const total = SESS * FLOP_RB_COUNT;
      // 4 帯すべて出現。クラスタ層化なので high(A+broadway) が厚く、ロー偏りが解消される。
      for (const band of ['A', 'broadway', 'mid', 'low']) {
        expect(counts[band]).toBeGreaterThan(0);
      }
      expect(counts.low / total).toBeLessThan(0.20); // ロー偏りなし (旧 ~28% → 大幅減)
      expect((counts.A + counts.broadway) / total).toBeGreaterThan(0.4); // ハイ系も十分
      expect(counts.A / total).toBeGreaterThan(0.1); // A 高ボードも埋もれない
    });

    it(`[${mode}] ランダム枠でクラスタが多様にカバー / overbet・check 枠が維持`, () => {
      const allClusters = new Set<number>();
      let withOverbet = 0;
      let withCheckHeavy = 0;
      for (let s = 0; s < 40; s++) {
        const qs = buildFlopRbQuestions(DATA, mode);
        for (const q of qs) {
          const id = clusterId(q);
          if (id !== null) allClusters.add(id);
          if (Math.max(q.strat['125'] ?? 0, q.strat.ALLIN ?? 0) >= 0.2) withOverbet++;
          if ((q.strat.check ?? 0) >= 0.5) withCheckHeavy++;
        }
      }
      expect(allClusters.size).toBeGreaterThan(30); // 40セッションで多くのクラスタが登場
      expect(withOverbet).toBeGreaterThan(0); // overbet 枠が維持される
      expect(withCheckHeavy).toBeGreaterThan(0); // check 枠が維持される
    });

    it(`[${mode}] 全て母集団内 (収録ボードのみ・母集団外フロップ混入なし)`, () => {
      for (let s = 0; s < 30; s++) {
        for (const q of buildFlopRbQuestions(DATA, mode)) {
          expect(CORPUS.has(board6(q))).toBe(true);
        }
      }
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
  it('timeout (制限時間切れ) は 0', () => {
    expect(scoreFlopRb(cbQ, { kind: 'timeout' })).toBe(0);
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
