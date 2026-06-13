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
  type FlopRbMode,
  FLOP_RB_COUNT,
  FLOP_RB_MAX_SCORE,
  FLOP_RB_CLEAR_SCORE,
  flopRbCountFor,
} from './flopIntermediateCb';

const BLIND_MODES: ReadonlyArray<FlopRbMode> = ['srp_limp_blind', '3bp_4bp_5bp_blind'];
const isBlindMode = (m: FlopRbMode) => BLIND_MODES.includes(m);
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

describe('CB SRP (srp_non_blind / srp_limp_blind) 出題生成', () => {
  it('非Blind=20問 / Blind(SBvBB)=10問・全て SRP・Blind フィルタが効く (50セッション安定)', () => {
    const bothBlind = (q: FlopRbQuestion) => ['SB', 'BB'].includes(q.hero) && ['SB', 'BB'].includes(q.villain);
    for (let s = 0; s < 50; s++) {
      for (const mode of ['srp_non_blind', 'srp_limp_blind'] as const) {
        const qs = buildFlopRbQuestions(DATA, mode);
        const c = counts(qs);
        expect(c.total).toBe(flopRbCountFor(mode)); // 20 or 10
        expect(c.srp).toBe(flopRbCountFor(mode));
        expect(c.threebet + c.fourbet + c.fivebet).toBe(0);
        // Blind = 両者 SB/BB のみ。non_blind には両者Blind が出ない、limp_blind は全て両者Blind。
        if (mode === 'srp_non_blind') expect(qs.some(bothBlind)).toBe(false);
        else expect(qs.every(bothBlind)).toBe(true);
      }
    }
  });

  it('選択肢は SRP のポット別 (check/33/50/75/125・ALLIN無し)・strat・似たボードを持つ', () => {
    for (const q of buildFlopRbQuestions(DATA, 'srp_non_blind')) {
      expect(q.board).toHaveLength(3);
      expect(q.choices).toEqual(['check', '33', '50', '75', '125']);
      expect(Object.keys(q.strat).length).toBeGreaterThan(0);
      expect(q.similar.length).toBeGreaterThan(0);
      for (const sim of q.similar) expect(sim.board).toHaveLength(3);
    }
  });
});

describe('CB 3BP/4BP/5BP (3bp_4bp_5bp_blind / _non_blind) 出題生成', () => {
  it('非Blind=20問で 4bet/5bet も毎回出る / Blind(SBvBB)=10問で 5bet を含まない (50セッション)', () => {
    for (let s = 0; s < 50; s++) {
      // 非Blind: 5bet は両者Blind=0 のためこちら側に存在。20問。
      const cn = counts(buildFlopRbQuestions(DATA, '3bp_4bp_5bp_non_blind'));
      expect(cn.total).toBe(flopRbCountFor('3bp_4bp_5bp_non_blind')); // 20
      expect(cn.srp).toBe(0);
      expect(cn.threebet).toBeGreaterThanOrEqual(1);
      expect(cn.fourbet).toBeGreaterThanOrEqual(1);
      expect(cn.fivebet).toBeGreaterThanOrEqual(1);
      // Blind: 5bet 0 件 (3bet+4bet のみ)。10問。
      const cb = counts(buildFlopRbQuestions(DATA, '3bp_4bp_5bp_blind'));
      expect(cb.total).toBe(flopRbCountFor('3bp_4bp_5bp_blind')); // 10
      expect(cb.fivebet).toBe(0);
      expect(cb.threebet).toBeGreaterThanOrEqual(1);
      expect(cb.fourbet).toBeGreaterThanOrEqual(1);
    }
  });

  it('ポット別選択肢: 5bet は check/33/50/ALLIN、4bet は ALLIN を含む', () => {
    for (const q of buildFlopRbQuestions(DATA, '3bp_4bp_5bp_non_blind')) {
      if (q.pot === '5bet') expect(q.choices).toEqual(['check', '33', '50', 'ALLIN']);
      if (q.pot === '4bet') {
        expect(q.choices).toContain('ALLIN');
      }
    }
  });

  it('オールイン主体(ALLIN>=20%)局面が出題される (ショートスタックの学習機会)', () => {
    let withAllin = 0;
    for (let s = 0; s < 20; s++) {
      withAllin += buildFlopRbQuestions(DATA, '3bp_4bp_5bp_non_blind').filter((q) => (q.strat.ALLIN ?? 0) >= 0.2).length;
    }
    expect(withAllin).toBeGreaterThan(0);
  });
});

describe('ドンク/BMCB (donk_bmcb) 出題生成', () => {
  it('全20問・ドンク と BMCB が毎回両方出る (意図的枠が 1:1 を保証, 50セッション)', () => {
    for (let s = 0; s < 50; s++) {
      const qs = buildFlopRbQuestions(DATA, 'donk_bmcb');
      expect(qs.length).toBe(FLOP_RB_COUNT);
      expect(qs.filter((q) => q.kind === 'donk').length).toBeGreaterThanOrEqual(1);
      expect(qs.filter((q) => q.kind === 'bmcb').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('SRP/3bet ポットのみ (4bet/5bet を含まない)', () => {
    for (const q of buildFlopRbQuestions(DATA, 'donk_bmcb')) {
      expect(['SRP', '3bet']).toContain(q.pot);
      expect(q.similar.length).toBeGreaterThan(0);
    }
  });

  it('kind に応じてシナリオラベルが prefix される', () => {
    for (const q of buildFlopRbQuestions(DATA, 'donk_bmcb')) {
      const label = flopRbScenarioLabel(q);
      if (q.kind === 'donk') expect(label.startsWith('donk ')).toBe(true);
      if (q.kind === 'bmcb') expect(label.startsWith('bmcb ')).toBe(true);
    }
  });
});

describe('共通 出題性質 (全モード)', () => {
  for (const mode of ['srp_non_blind', 'srp_limp_blind', '3bp_4bp_5bp_non_blind', '3bp_4bp_5bp_blind', 'donk_bmcb'] as const) {
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

    it(`[${mode}] 支配サイズが偏らない (複数セッションで2種以上出る)`, () => {
      // check 主体モード (srp/donkbmcb) は 1 セッション全 check もあり得るため集約で評価。
      const doms = new Set<string>();
      for (let s = 0; s < 20; s++) {
        for (const q of buildFlopRbQuestions(DATA, mode)) doms.add(dominant(q.strat));
      }
      expect(doms.size).toBeGreaterThanOrEqual(2);
    });

    it(`[${mode}] hero ポジションが多様 (1強にならない)`, () => {
      const heroes = new Map<string, number>();
      for (let s = 0; s < 30; s++) {
        for (const q of buildFlopRbQuestions(DATA, mode)) heroes.set(q.hero, (heroes.get(q.hero) ?? 0) + 1);
      }
      const total = [...heroes.values()].reduce((a, b) => a + b, 0);
      const max = Math.max(...heroes.values());
      // Blind モードは hero が SB/BB のみのため緩め。
      expect(max / total).toBeLessThan(isBlindMode(mode) ? 0.85 : 0.6);
    });

    it(`[${mode}] 同一ボード(カード)は重複しない (マッチアップ違いも含む) / 規定問数揃う`, () => {
      for (let s = 0; s < 30; s++) {
        const qs = buildFlopRbQuestions(DATA, mode);
        expect(qs.length).toBe(flopRbCountFor(mode));
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
      const total = SESS * flopRbCountFor(mode);
      // 4 帯すべて出現。クラスタ層化なので high(A+broadway) が厚く、ロー偏りが解消される。
      for (const band of ['A', 'broadway', 'mid', 'low']) {
        expect(counts[band]).toBeGreaterThan(0);
      }
      // Blind モードは SBvBB の小プールのため緩め。
      const lowMax = isBlindMode(mode) ? 0.3 : 0.2;
      const highMin = isBlindMode(mode) ? 0.3 : 0.4;
      expect(counts.low / total).toBeLessThan(lowMax);
      expect((counts.A + counts.broadway) / total).toBeGreaterThan(highMin);
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

    it(`[${mode}] run-aware: 支配サイズの連続が短縮される (平均)`, () => {
      // check主体の srp/donkbmcb は content 由来で 1 セッション全 check もあり得る (max は content 上限)。
      // よって「平均最長連続」で評価。3bp は実現可能なので厳しめ、check主体は緩め。
      const bound = mode.startsWith('3bp') ? 5 : mode === 'donk_bmcb' ? 9 : 8;
      let sum = 0;
      const S = 80;
      for (let s = 0; s < S; s++) {
        const qs = buildFlopRbQuestions(DATA, mode);
        let run = 1;
        let mx = 1;
        for (let i = 1; i < qs.length; i++) {
          run = dominant(qs[i].strat) === dominant(qs[i - 1].strat) ? run + 1 : 1;
          mx = Math.max(mx, run);
        }
        sum += mx;
      }
      expect(sum / S).toBeLessThanOrEqual(bound);
    });

    it(`[${mode}] 全て母集団内 (収録ボードのみ・母集団外フロップ混入なし)`, () => {
      for (let s = 0; s < 30; s++) {
        for (const q of buildFlopRbQuestions(DATA, mode)) {
          expect(CORPUS.has(board6(q))).toBe(true);
        }
      }
    });
  }

  it('満点/クリア定数 (20問×2pt=40、クリア80%=32)', () => {
    expect(FLOP_RB_COUNT).toBe(20);
    expect(FLOP_RB_MAX_SCORE).toBe(40);
    expect(FLOP_RB_CLEAR_SCORE).toBe(32);
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
