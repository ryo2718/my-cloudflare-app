// フロップ初級: 出題生成 (20問構成・配分) + 採点のテスト。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFlopQuestions,
  scoreFlopAnswer,
  flopScenarioLabel,
  flopOop,
  flopShowsVillainCheck,
  apportionByRatio,
  rollIntentionalCount,
  BEGINNER_INTENTIONAL_MIN,
  BEGINNER_INTENTIONAL_MAX,
  BEGINNER_CATEGORY_RATIO,
  type FlopTrainingData,
  type FlopQuestion,
  FLOP_BEGINNER_COUNT,
} from './flopBeginner';
import { getClusterId } from './boardClusters';

const DATA: FlopTrainingData = JSON.parse(
  readFileSync('public/data/flop/flop_training_v1.json', 'utf8'),
);

const boardStr = (q: FlopQuestion) => q.board.map((c) => c.rank + c.suit).join('');
const POOL = new Set<string>();
for (const byBand of Object.values(DATA.cb)) for (const arr of Object.values(byBand)) for (const r of arr) POOL.add(r.board);
for (const arr of Object.values(DATA.donk)) for (const r of arr) POOL.add(r.board);

describe('フロップ初級 出題生成 (ハイブリッド: 意図的 + ランダム)', () => {
  it('全20問・同一ボード重複なし・全て母集団内 (100セッション)', () => {
    for (let s = 0; s < 100; s++) {
      const qs = buildFlopQuestions(DATA);
      expect(qs.length).toBe(FLOP_BEGINNER_COUNT);
      const boards = qs.map(boardStr);
      expect(new Set(boards).size).toBe(qs.length); // 重複なし
      for (const b of boards) expect(POOL.has(b)).toBe(true); // 母集団外フロップは混入しない
    }
  });

  it('意図的総数 N=4〜8 が揃う / 内訳が 9:6:5 で按分される', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const n = rollIntentionalCount(BEGINNER_INTENTIONAL_MIN, BEGINNER_INTENTIONAL_MAX);
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(8);
      seen.add(n);
    }
    expect(seen.size).toBe(5); // 4,5,6,7,8 すべて出る
    // 最大剰余法での按分 (CB打つ:CB打たない:ドンク)
    expect(apportionByRatio(4, BEGINNER_CATEGORY_RATIO)).toEqual([2, 1, 1]);
    expect(apportionByRatio(5, BEGINNER_CATEGORY_RATIO)).toEqual([2, 2, 1]);
    expect(apportionByRatio(6, BEGINNER_CATEGORY_RATIO)).toEqual([3, 2, 1]);
    expect(apportionByRatio(7, BEGINNER_CATEGORY_RATIO)).toEqual([3, 2, 2]);
    expect(apportionByRatio(8, BEGINNER_CATEGORY_RATIO)).toEqual([4, 2, 2]);
    for (let n = 4; n <= 8; n++) {
      const a = apportionByRatio(n, BEGINNER_CATEGORY_RATIO);
      expect(a.reduce((x, y) => x + y, 0)).toBe(n);
      for (const v of a) expect(v).toBeGreaterThanOrEqual(1); // 各カテゴリ最低1
    }
  });

  it('ランダム枠でクラスタが多様にカバーされる', () => {
    const all = new Set<number>();
    for (let s = 0; s < 100; s++) {
      const qs = buildFlopQuestions(DATA);
      const per = new Set<number>();
      for (const q of qs) {
        const id = getClusterId(boardStr(q));
        if (id !== null) { per.add(id); all.add(id); }
      }
      expect(per.size).toBeGreaterThanOrEqual(12); // 1セッション20問で十分多様
    }
    expect(all.size).toBeGreaterThan(45); // 100セッションでほぼ全クラスタ出現
  });

  it('正誤と頻度/閾値の整合 (CB=0.7 / donk=0.6)', () => {
    for (const q of buildFlopQuestions(DATA)) {
      const th = q.type === 'cb' ? 0.7 : 0.6;
      expect(q.threshold).toBe(th);
      expect(q.correct).toBe(q.rate >= th ? 'bet' : 'check');
      expect(q.board).toHaveLength(3);
    }
  });

  it('出題順がシャッフルされる (CB打つ→打たない→ドンク の固まりにならない)', () => {
    // レシピ順のままなら先頭は必ず cb/bet。シャッフルされていれば先頭の type/correct が変動する。
    const firstKeys = new Set<string>();
    let interleaved = false;
    for (let s = 0; s < 40; s++) {
      const qs = buildFlopQuestions(DATA);
      firstKeys.add(`${qs[0].type}:${qs[0].correct}`);
      // donk(末尾5問)が後半に固まっていない = どこかで donk より後に cb が来る
      const lastDonk = qs.map((q) => q.type).lastIndexOf('donk');
      const firstCbAfter = qs.findIndex((q, i) => i > 0 && q.type === 'cb');
      if (lastDonk > firstCbAfter && qs.slice(0, lastDonk).some((q) => q.type === 'cb')) interleaved = true;
    }
    expect(firstKeys.size).toBeGreaterThan(1); // 先頭が毎回同じでない = シャッフルされている
    expect(interleaved).toBe(true); // donk と cb が混ざる
  });

  it('同一ボード(カード)は重複しない (意図的とランダムでもかぶらない)', () => {
    for (let s = 0; s < 30; s++) {
      const qs = buildFlopQuestions(DATA);
      const boards = qs.map(boardStr);
      expect(new Set(boards).size).toBe(qs.length);
    }
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

describe('flopOop / flopShowsVillainCheck (修正1: アニメの流れ)', () => {
  it('flopOop: ポストフロップで先に動く側 (SB,BB,...,BTN 順) を返す', () => {
    expect(flopOop('BTN', 'BB')).toBe('BB'); // BB が先 (OOP)
    expect(flopOop('SB', 'BTN')).toBe('SB'); // SB が先 (OOP)
    expect(flopOop('CO', 'SB')).toBe('SB');
  });
  it('CB問題でヒーローが IP (相手 OOP) のときだけ check を挟む', () => {
    // CO(hero) vs SB(villain): SB が OOP → CB前に SB check
    expect(flopShowsVillainCheck({ type: 'cb', hero: 'CO', villain: 'SB' })).toBe(true);
    // SB(hero, OOP) vs BB: ヒーローが先頭手番 → check なし
    expect(flopShowsVillainCheck({ type: 'cb', hero: 'SB', villain: 'BB' })).toBe(false);
    // ドンク (ヒーロー OOP) → check なし
    expect(flopShowsVillainCheck({ type: 'donk', hero: 'BB', villain: 'BTN' })).toBe(false);
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
