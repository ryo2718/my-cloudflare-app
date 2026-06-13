// フロップ中級CB(個別ハンド): 出題生成 (30問: SRP20/3bp7/4bp3) + 満点相当のみ1pt採点。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFlopPhQuestions,
  scoreFlopPh,
  flopPhScenarioLabel,
  type FlopPhData,
  type FlopPhQuestion,
  FLOP_PH_COUNT,
  FLOP_PH_MAX_SCORE,
  FLOP_PH_CLEAR_SCORE,
} from './flopPerHandCb';
import type { FlopCbStrat } from './flopIntermediateCb';

const DATA: FlopPhData = JSON.parse(readFileSync('public/data/flop/flop_perhand_v1.json', 'utf8'));

function counts(qs: FlopPhQuestion[]) {
  return {
    total: qs.length,
    SRP: qs.filter((q) => q.scenario === 'SRP').length,
    '3bet': qs.filter((q) => q.scenario === '3bet').length,
    '4bet': qs.filter((q) => q.scenario === '4bet').length,
  };
}

describe('中級CB(個別ハンド) 出題生成', () => {
  it('全30問・SRP20/3bp7/4bp3 (30セッション安定)', () => {
    for (let s = 0; s < 30; s++) {
      const c = counts(buildFlopPhQuestions(DATA));
      expect(c.total).toBe(FLOP_PH_COUNT);
      expect(c.SRP).toBe(20);
      expect(c['3bet']).toBe(7);
      expect(c['4bet']).toBe(3);
    }
  });

  it('選択肢 check/33/50/75/125、ボード3枚、ヒーロー2枚はボードと衝突しない', () => {
    for (const q of buildFlopPhQuestions(DATA)) {
      expect(q.choices).toEqual(['check', '33', '50', '75', '125']);
      expect(q.board).toHaveLength(3);
      const boardKeys = new Set(q.board.map((c) => c.rank + c.suit));
      for (const c of q.heroCards) expect(boardKeys.has(c.rank + c.suit)).toBe(false);
      expect(Object.keys(q.rangeHands).length).toBeGreaterThan(0); // grid 用
      expect(q.preflopActions.length).toBeGreaterThan(0); // アニメ用 (中級レンジから流用)
    }
  });

  it('100%チェックのハンドは出題されない (strat.check < 1)', () => {
    for (const q of buildFlopPhQuestions(DATA)) {
      expect(q.strat.check).toBeLessThan(1);
    }
  });

  it('同一 label:board:hand は重複しない', () => {
    const qs = buildFlopPhQuestions(DATA);
    const keys = qs.map((q) => `${q.label}:${q.board.map((c) => c.rank + c.suit).join('')}:${q.hand}`);
    expect(new Set(keys).size).toBe(qs.length);
  });

  it('満点/クリア定数 (30問×1pt=30、クリア=27)', () => {
    expect(FLOP_PH_MAX_SCORE).toBe(30);
    expect(FLOP_PH_CLEAR_SCORE).toBe(27);
  });
});

describe('scoreFlopPh (満点相当のみ 1pt)', () => {
  it('主要アクションを正しく選ぶと1pt', () => {
    const strat: FlopCbStrat = { check: 0, '33': 1, '50': 0, '75': 0, '125': 0 };
    expect(scoreFlopPh(strat, { selections: ['33'] })).toEqual({ correct: true, points: 1 });
  });
  it('混合を過不足なく選べば1pt', () => {
    const strat: FlopCbStrat = { check: 0.5, '33': 0.5 };
    expect(scoreFlopPh(strat, { selections: ['check', '33'] }).points).toBe(1);
  });
  it('部分的 (一方だけ) は0pt (満点相当でない)', () => {
    const strat: FlopCbStrat = { check: 0.5, '33': 0.5 };
    expect(scoreFlopPh(strat, { selections: ['33'] }).points).toBe(0);
  });
  it('0%アクションを選ぶと0pt', () => {
    const strat: FlopCbStrat = { check: 0, '33': 1 };
    expect(scoreFlopPh(strat, { selections: ['check'] }).points).toBe(0);
  });
});

describe('flopPhScenarioLabel', () => {
  it('srp/3bp/4bp タグ + ラベル', () => {
    expect(flopPhScenarioLabel({ scenario: 'SRP', label: 'CO vs BTN' })).toBe('srp CO vs BTN');
    expect(flopPhScenarioLabel({ scenario: '3bet', label: 'SB vs BB' })).toBe('3bp SB vs BB');
    expect(flopPhScenarioLabel({ scenario: '4bet', label: 'HJ vs BTN' })).toBe('4bp HJ vs BTN');
  });
});
