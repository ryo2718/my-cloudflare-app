// ranking SQL の挙動テスト (D1 接続なしで集計ロジックを検証)。
//
// 注: 実 D1 接続は wrangler dev でしか動かないため、ここでは「sort/filter/my_rank 計算」
//     のロジックを純粋関数として再実装してテストする。本番 SQL と概念的に同等であることを
//     担保し、回帰防止する。

import { describe, expect, it } from 'vitest';

interface FakeAccount {
  account_id: number;
  poker_name: string;
  is_admin: number;
  total_points: number;
}

/**
 * functions/api/ranking.ts の SQL と同じセマンティクスを TS で再現:
 *  - WHERE a.is_admin = 0
 *  - ORDER BY total_points DESC, account_id ASC
 *  - rank 計算と my_rank 抽出
 */
function buildRanking(
  rows: ReadonlyArray<FakeAccount>,
  meId: number,
): { ranking: { rank: number; poker_name: string }[]; my_rank: number | null } {
  const filtered = rows
    .filter((r) => r.is_admin === 0)
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return a.account_id - b.account_id;
    });
  let myRank: number | null = null;
  const ranking = filtered.map((row, idx) => {
    const rank = idx + 1;
    if (row.account_id === meId) myRank = rank;
    return { rank, poker_name: row.poker_name };
  });
  return { ranking, my_rank: myRank };
}

const SAMPLE: FakeAccount[] = [
  { account_id: 1, poker_name: 'テスト君', is_admin: 1, total_points: 9999 },
  { account_id: 2, poker_name: 'ryoji',  is_admin: 0, total_points: 35 },
  { account_id: 3, poker_name: 'yuyu',   is_admin: 0, total_points: 40 },
  { account_id: 4, poker_name: 'てぐ',   is_admin: 0, total_points: 40 },  // 同点でタイブレイク
  { account_id: 5, poker_name: 'けい',   is_admin: 0, total_points: 0 },   // 未挑戦
];

describe('ranking buildRanking (admin 除外 + ソート + my_rank)', () => {
  it('admin は ranking に含まれない', () => {
    const r = buildRanking(SAMPLE, 2);
    expect(r.ranking.find((x) => x.poker_name === 'テスト君')).toBeUndefined();
  });

  it('admin が叩いた場合 my_rank=null', () => {
    const r = buildRanking(SAMPLE, 1); // テスト君=admin
    expect(r.my_rank).toBeNull();
  });

  it('一般ユーザーの my_rank が正しい', () => {
    const r = buildRanking(SAMPLE, 3); // yuyu (40pt, 1位)
    expect(r.my_rank).toBe(1);
    const r2 = buildRanking(SAMPLE, 4); // てぐ (40pt, 2位 タイブレイク)
    expect(r2.my_rank).toBe(2);
    const r3 = buildRanking(SAMPLE, 2); // ryoji (35pt, 3位)
    expect(r3.my_rank).toBe(3);
    const r4 = buildRanking(SAMPLE, 5); // けい (0pt, 4位)
    expect(r4.my_rank).toBe(4);
  });

  it('未挑戦者 (0pt) も含まれる (末尾)', () => {
    const r = buildRanking(SAMPLE, 5);
    expect(r.ranking[r.ranking.length - 1].poker_name).toBe('けい');
  });

  it('同点はタイブレイクで account_id 昇順', () => {
    const r = buildRanking(SAMPLE, 3);
    expect(r.ranking[0].poker_name).toBe('yuyu');  // id=3
    expect(r.ranking[1].poker_name).toBe('てぐ');  // id=4
  });

  it('admin が 0 人でも一般ユーザーの順位が正しい', () => {
    const noAdmin = SAMPLE.filter((a) => a.is_admin === 0);
    const r = buildRanking(noAdmin, 3);
    expect(r.ranking).toHaveLength(4);
    expect(r.my_rank).toBe(1);
  });

  it('pt 数値はレスポンスに含まれない (rank と poker_name のみ)', () => {
    const r = buildRanking(SAMPLE, 3);
    for (const row of r.ranking) {
      expect(Object.keys(row).sort()).toEqual(['poker_name', 'rank']);
    }
  });
});
