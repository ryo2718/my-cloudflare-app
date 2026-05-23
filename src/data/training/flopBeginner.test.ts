// フロップ初級: 出題生成 (20問構成・配分) + 採点のテスト。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFlopQuestions,
  scoreFlopAnswer,
  flopScenarioLabel,
  type FlopTrainingData,
  type FlopQuestion,
  FLOP_BEGINNER_COUNT,
} from './flopBeginner';

const DATA: FlopTrainingData = JSON.parse(
  readFileSync('public/data/flop/flop_training_v1.json', 'utf8'),
);

function counts(qs: FlopQuestion[]) {
  return {
    total: qs.length,
    cb: qs.filter((q) => q.type === 'cb').length,
    donk: qs.filter((q) => q.type === 'donk').length,
    cbSRP: qs.filter((q) => q.type === 'cb' && q.pot === 'SRP').length,
    cb3bet: qs.filter((q) => q.type === 'cb' && q.pot === '3bet').length,
    cbBet: qs.filter((q) => q.type === 'cb' && q.correct === 'bet').length,
    cbCheck: qs.filter((q) => q.type === 'cb' && q.correct === 'check').length,
    donkBet: qs.filter((q) => q.type === 'donk' && q.correct === 'bet').length,
    donkCheck: qs.filter((q) => q.type === 'donk' && q.correct === 'check').length,
  };
}

describe('フロップ初級 出題生成', () => {
  it('全20問・CB15・ドンク5 (50セッション安定)', () => {
    for (let s = 0; s < 50; s++) {
      const qs = buildFlopQuestions(DATA);
      const c = counts(qs);
      expect(c.total).toBe(FLOP_BEGINNER_COUNT);
      expect(c.cb).toBe(15);
      expect(c.donk).toBe(5);
    }
  });

  it('CB内訳: SRP9 (打つ6/打たない3) / 3bet6 (打つ3/打たない3)、ドンク 打つ3/打たない2', () => {
    const c = counts(buildFlopQuestions(DATA));
    expect(c.cbSRP).toBe(9);
    expect(c.cb3bet).toBe(6);
    expect(c.cbBet).toBe(9); // SRP打つ6 + 3bet打つ3
    expect(c.cbCheck).toBe(6); // SRP打たない3 + 3bet打たない3
    expect(c.donkBet).toBe(3); // 70%〜
    expect(c.donkCheck).toBe(2); // 0〜5%
  });

  it('正誤と頻度/閾値の整合 (CB=0.7 / donk=0.6)', () => {
    for (const q of buildFlopQuestions(DATA)) {
      const th = q.type === 'cb' ? 0.7 : 0.6;
      expect(q.threshold).toBe(th);
      expect(q.correct).toBe(q.rate >= th ? 'bet' : 'check');
      expect(q.board).toHaveLength(3);
    }
  });

  it('同一 variant:board は重複しない', () => {
    const qs = buildFlopQuestions(DATA);
    const keys = qs.map((q) => `${q.variant}:${q.board.map((c) => c.rank + c.suit).join('')}`);
    expect(new Set(keys).size).toBe(qs.length);
  });

  it('各問に villain / preflopActions / actions(bp付き) が入る', () => {
    for (const q of buildFlopQuestions(DATA)) {
      expect(q.villain).toBeTruthy();
      expect(q.villain).not.toBe(q.hero);
      expect(q.preflopActions.length).toBeGreaterThan(0); // open/fold/call の列
      for (const a of q.actions) expect(typeof a.bp).toBe('number');
    }
  });
});

describe('flopScenarioLabel (修正3)', () => {
  it('SRP: "srp {hero} vs {villain}"', () => {
    expect(flopScenarioLabel({ pot: 'SRP', hero: 'BTN', villain: 'BB' })).toBe('srp BTN vs BB');
  });
  it('3bet: "3bp {hero} vs {villain}" (3betした側がヒーロー)', () => {
    expect(flopScenarioLabel({ pot: '3bet', hero: 'BB', villain: 'BTN' })).toBe('3bp BB vs BTN');
  });
});

describe('フロップ初級 採点', () => {
  const q = (correct: 'bet' | 'check'): FlopQuestion => ({
    id: 1, type: 'cb', pot: 'SRP', variant: 'btnr_bbc', hero: 'BTN', villain: 'BB',
    board: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' }],
    rate: correct === 'bet' ? 0.9 : 0.1, threshold: 0.7, correct, actions: [], preflopActions: [],
  });

  it('正解で1pt、不正解で0pt、無回答で0pt', () => {
    expect(scoreFlopAnswer(q('bet'), 'bet')).toEqual({ points: 1, correct: true });
    expect(scoreFlopAnswer(q('bet'), 'check')).toEqual({ points: 0, correct: false });
    expect(scoreFlopAnswer(q('check'), 'check')).toEqual({ points: 1, correct: true });
    expect(scoreFlopAnswer(q('check'), null)).toEqual({ points: 0, correct: false });
  });
});
