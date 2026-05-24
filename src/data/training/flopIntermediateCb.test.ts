// フロップ中級レンジベット: 出題生成 (25問: CB15/Donk10) + CB複数選択採点 + Donkスライダー採点。

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

function counts(qs: FlopRbQuestion[]) {
  const donk = qs.filter((q) => q.kind === 'donk');
  return {
    total: qs.length,
    cb: qs.filter((q) => q.kind === 'cb').length,
    donk: donk.length,
    donkSRP: donk.filter((q) => q.pot === 'SRP').length,
    donk3bet: donk.filter((q) => q.pot === '3bet').length,
    donk4bet: donk.filter((q) => q.pot === '4bet').length,
  };
}

describe('中級レンジベット 出題生成', () => {
  it('全25問・CB15(全SRP)/Donk10(SRP4/3bp3/4bp3) (50セッション安定)', () => {
    for (let s = 0; s < 50; s++) {
      const c = counts(buildFlopRbQuestions(DATA));
      expect(c.total).toBe(FLOP_RB_COUNT);
      expect(c.cb).toBe(15);
      expect(c.donk).toBe(10);
      expect(c.donkSRP).toBe(4);
      expect(c.donk3bet).toBe(3);
      expect(c.donk4bet).toBe(3);
    }
  });

  it('CB問題は全SRP・選択肢 check/33/50/75/125 / Donk問題は donkRate を持つ', () => {
    for (const q of buildFlopRbQuestions(DATA)) {
      expect(q.board).toHaveLength(3);
      if (q.kind === 'cb') {
        expect(q.pot).toBe('SRP');
        expect(q.choices).toEqual(['check', '33', '50', '75', '125']);
      } else {
        expect(q.donkRate).toBeGreaterThanOrEqual(0.05);
        expect(['SRP', '3bet', '4bet']).toContain(q.pot);
      }
    }
  });

  it('同一 variant:board は重複しない', () => {
    const qs = buildFlopRbQuestions(DATA);
    const keys = qs.map((q) => `${q.variant}:${q.board.map((c) => c.rank + c.suit).join('')}`);
    expect(new Set(keys).size).toBe(qs.length);
  });

  it('満点/クリア定数 (25問×2pt=50、クリア=45)', () => {
    expect(FLOP_RB_MAX_SCORE).toBe(50);
    expect(FLOP_RB_CLEAR_SCORE).toBe(45);
  });
});

describe('flopCbBucket (SRP 丸め)', () => {
  it('33/50/75/125 最近傍、allin→125', () => {
    expect(flopCbBucket(33)).toBe('33');
    expect(flopCbBucket(75)).toBe('75');
    expect(flopCbBucket(60)).toBe('50');
    expect(flopCbBucket(0, true)).toBe('125');
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

describe('scoreFlopRb (CB=複数選択 / Donk=スライダー)', () => {
  const cbQ: FlopRbQuestion = {
    kind: 'cb', id: 1, pot: 'SRP', variant: 'cor_btnc', hero: 'CO', villain: 'BTN',
    board: board(), choices: ['check', '33', '50', '75', '125'],
    strat: { check: 0.1, '33': 0.6, '50': 0.3 }, preflopActions: [],
  };
  const donkQ: FlopRbQuestion = {
    kind: 'donk', id: 2, pot: '3bet', variant: 'utgr_btnr_utgc', hero: 'UTG', villain: 'BTN',
    board: board(), donkRate: 0.3, preflopActions: [],
  };

  it('CB: select で複数選択採点', () => {
    expect(scoreFlopRb(cbQ, { kind: 'select', selections: ['33', '50'] })).toBe(2);
  });
  it('Donk: slider で正解頻度との差で採点 (±10→2 / ±20→1 / それ以外-1)', () => {
    expect(scoreFlopRb(donkQ, { kind: 'slider', pct: 30 })).toBe(2); // ぴったり
    expect(scoreFlopRb(donkQ, { kind: 'slider', pct: 50 })).toBe(1); // ±20
    expect(scoreFlopRb(donkQ, { kind: 'slider', pct: 80 })).toBe(-1); // 大外し
  });
  it('Donk: skip は 0', () => {
    expect(scoreFlopRb(donkQ, { kind: 'skip' })).toBe(0);
  });
});

describe('flopRbScenarioLabel', () => {
  it('ポット種別タグ (srp/3bp/4bp)', () => {
    expect(flopRbScenarioLabel({ pot: 'SRP', hero: 'CO', villain: 'BTN' })).toBe('srp CO vs BTN');
    expect(flopRbScenarioLabel({ pot: '3bet', hero: 'UTG', villain: 'BTN' })).toBe('3bp UTG vs BTN');
    expect(flopRbScenarioLabel({ pot: '4bet', hero: 'CO', villain: 'BTN' })).toBe('4bp CO vs BTN');
  });
});
