// 中級レンジベット data の high-card 分布検証 + 出題のランダム選択検証。
//   - 偏り修正(high-card 層化抽出)で各プールに A/K/Q-high が出現し、
//     ローボード(high<=7)への極端な偏りが解消したことを担保する。
//   - 出題ジェネレータが毎回ランダムにボードを選ぶ(セッション間で異なる)ことを担保する。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildFlopRbQuestions, type FlopRbData } from './flopIntermediateCb';

const DATA: FlopRbData = JSON.parse(readFileSync('public/data/flop/flop_rangebet_v1.json', 'utf8'));

const ORDER = '23456789TJQKA';
const rv = (r: string) => ORDER.indexOf(r);
const highOfStr = (b: string) => [b[0], b[2], b[4]].reduce((a, c) => (rv(c) > rv(a) ? c : a));
const highOfCards = (b: ReadonlyArray<{ rank: string }>) =>
  b.map((c) => c.rank).reduce((a, c) => (rv(c) > rv(a) ? c : a));

function pct(boards: string[], pred: (h: string) => boolean): number {
  return boards.filter((b) => pred(highOfStr(b))).length / boards.length;
}

describe('rangebet データ high-card 分布 (層化抽出)', () => {
  const pools: Array<[string, { board: string }[]]> = [
    ['cb.SRP', DATA.cb.SRP],
    ['cb.3bet', DATA.cb['3bet']],
    ['cb.4bet5bet', DATA.cb['4bet5bet']],
    ['bmcb', DATA.bmcb ?? []],
  ];

  it.each(pools)('%s に A/K/Q-high が存在し high<=7 が極端でない', (_name, pool) => {
    const boards = pool.map((x) => x.board);
    const highs = new Set(boards.map(highOfStr));
    // ハイカードボードが出現する (旧データは A/K/Q/J が 0% だった)。
    expect(highs.has('A')).toBe(true);
    expect(highs.has('K')).toBe(true);
    expect(highs.has('Q')).toBe(true);
    // ローボード(high<=7)への極端な偏りが解消 (旧データは 86〜100%)。
    expect(pct(boards, (h) => rv(h) <= rv('7'))).toBeLessThanOrEqual(0.5);
  });
});

describe('出題のランダム選択', () => {
  it('SRP 出題はセッション間でボード集合が変わる (ランダム)', () => {
    const key = (qs: { board: { rank: string; suit: string }[] }[]) =>
      qs.map((q) => q.board.map((c) => `${c.rank}${c.suit}`).join('')).join(',');
    const a = key(buildFlopRbQuestions(DATA, 'srp'));
    const b = key(buildFlopRbQuestions(DATA, 'srp'));
    expect(a).not.toBe(b); // 毎回同じ固定ボードではない
  });

  it('複数セッション集計で A/K/Q-high が出題され、high<=7 偏重でない', () => {
    const highs: Record<string, number> = {};
    let n = 0;
    let le7 = 0;
    for (let i = 0; i < 30; i++) {
      for (const q of buildFlopRbQuestions(DATA, 'srp')) {
        const h = highOfCards(q.board);
        highs[h] = (highs[h] || 0) + 1;
        n++;
        if (rv(h) <= rv('7')) le7++;
      }
    }
    expect(highs['A'] ?? 0).toBeGreaterThan(0);
    expect(highs['K'] ?? 0).toBeGreaterThan(0);
    expect(highs['Q'] ?? 0).toBeGreaterThan(0);
    // 出題段階は sampleVaried がやや low 寄りに再偏在する (SRP で実測 ~54%) が、
    // 旧データの 86〜100% からは大幅改善。極端な偏重でないことのみ担保。
    expect(le7 / n).toBeLessThanOrEqual(0.6);
  });
});
