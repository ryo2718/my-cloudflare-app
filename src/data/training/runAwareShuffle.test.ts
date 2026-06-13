// run-aware シャッフル: 多数派が長く連続しないよう等間隔配置することの検証。

import { describe, it, expect } from 'vitest';
import { shuffleWithRunLimit, longestRun } from './runAwareShuffle';

const id = (x: string) => x;
function mk(counts: Record<string, number>): string[] {
  const a: string[] = [];
  for (const [k, n] of Object.entries(counts)) for (let i = 0; i < n; i++) a.push(k);
  return a;
}
const sortedOf = (a: string[]) => [...a].sort();

describe('longestRun', () => {
  it('連続の最長を返す', () => {
    expect(longestRun(['a', 'a', 'b', 'a'], id)).toBe(2);
    expect(longestRun(['a', 'a', 'a'], id)).toBe(3);
    expect(longestRun([], id)).toBe(0);
    expect(longestRun(['a', 'b', 'c'], id)).toBe(1);
  });
});

describe('shuffleWithRunLimit', () => {
  it('要素 (multiset) を保存する (並べ替えのみ)', () => {
    const items = mk({ a: 12, b: 7, c: 1 });
    for (let i = 0; i < 50; i++) {
      const r = shuffleWithRunLimit(items, id, 3);
      expect(r.length).toBe(items.length);
      expect(sortedOf(r)).toEqual(sortedOf(items));
    }
  });

  it('均衡 (15:15) は最大2連続まで', () => {
    for (let i = 0; i < 100; i++) {
      const r = shuffleWithRunLimit(mk({ a: 15, b: 15 }), id, 3);
      expect(longestRun(r, id)).toBeLessThanOrEqual(2);
    }
  });

  it('実現可能 (多数派22 + 分離材8) は最大3連続以下', () => {
    for (let i = 0; i < 100; i++) {
      const r = shuffleWithRunLimit(mk({ check: 22, x33: 4, x50: 2, x75: 1, x125: 1 }), id, 3);
      expect(longestRun(r, id)).toBeLessThanOrEqual(3);
    }
  });

  it('実現不能 (多数派が極端) でもベストエフォートで連続を大幅短縮', () => {
    // 25 vs 5 → 理論下限 ceil(25/6)=5。少なくともベースライン(=25連続)よりは大幅に減る。
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      worst = Math.max(worst, longestRun(shuffleWithRunLimit(mk({ a: 25, b: 5 }), id, 3), id));
    }
    expect(worst).toBeLessThanOrEqual(7); // 25 連続が ~5-6 まで短縮
  });

  it('maxRun 未満の小配列はそのまま (ランダム順)', () => {
    const r = shuffleWithRunLimit(['a', 'b'], id, 3);
    expect(sortedOf(r)).toEqual(['a', 'b']);
  });
});
