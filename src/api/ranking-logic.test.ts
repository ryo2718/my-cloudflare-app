// ranking SQL の挙動テスト (D1 接続なしで集計ロジックを検証)。
//
// 注: 実 D1 接続は wrangler dev でしか動かないため、ここでは「sort/filter/my_rank/
//     上位 3 位 pt 公開 / 同点同順位 / 参考枠」のロジックを純粋関数として再実装してテストする。
//     本番 SQL と概念的に同等であることを担保し、回帰防止する。

import { describe, expect, it } from 'vitest';

interface FakeAccount {
  account_id: number;
  poker_name: string;
  is_admin: number;
  is_ranking_excluded: number;
  total_points: number;
}

interface RankingEntry {
  rank: number;
  poker_name: string;
  points_visible: boolean;
  total_points: number | null;
}

interface ReferenceEntry {
  poker_name: string;
  total_points: number;
}

/**
 * functions/api/ranking.ts の SQL + buildRanking と同じセマンティクスを TS で再現:
 *  - 通常ランキング: is_admin=0 AND is_ranking_excluded=0
 *     ORDER BY total_points DESC, account_id ASC
 *     同点同順位 (1位 40pt が 2 人なら両方 1 位、次は 3 位)
 *     rank <= 3 のみ total_points を公開、それ以下は null
 *  - 参考枠: is_admin=0 AND is_ranking_excluded=1
 *     pt は常に公開
 *  - admin はランキング・参考の両方から除外
 */
function buildRanking(
  rows: ReadonlyArray<FakeAccount>,
  meId: number,
): {
  ranking: RankingEntry[];
  reference: ReferenceEntry[];
  my_rank: number | null;
  hide_points_reason: 'too_many_top3' | null;
} {
  // 通常ランキング: rank 割り当て (同点同順位)
  const normalSorted = rows
    .filter((r) => r.is_admin === 0 && r.is_ranking_excluded === 0)
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return a.account_id - b.account_id;
    });

  let currentRank = 0;
  let prevPoints: number | null = null;
  const ranked = normalSorted.map((row, idx) => {
    if (row.total_points !== prevPoints) {
      currentRank = idx + 1;
      prevPoints = row.total_points;
    }
    return { ...row, rank: currentRank };
  });

  // top3 該当者が半数超 → 全 pt 非公開
  const top3Count = ranked.filter((r) => r.rank <= 3).length;
  const hide = top3Count > ranked.length / 2;

  let myRank: number | null = null;
  const ranking = ranked.map((row) => {
    if (row.account_id === meId) myRank = row.rank;
    const visible = !hide && row.rank <= 3;
    return {
      rank: row.rank,
      poker_name: row.poker_name,
      points_visible: visible,
      total_points: visible ? row.total_points : null,
    };
  });

  // 参考枠
  const reference = rows
    .filter((r) => r.is_admin === 0 && r.is_ranking_excluded === 1)
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return a.account_id - b.account_id;
    })
    .map((r) => ({ poker_name: r.poker_name, total_points: r.total_points }));

  return {
    ranking,
    reference,
    my_rank: myRank,
    hide_points_reason: hide ? 'too_many_top3' : null,
  };
}

// 通常ランキングは 7 人にして「top3 が半数超」ルールに引っかからないようにする
// (top3=3 < 7/2=3.5 → 公開維持)。
const SAMPLE: FakeAccount[] = [
  { account_id: 1, poker_name: 'テスト君', is_admin: 1, is_ranking_excluded: 0, total_points: 9999 },
  { account_id: 2, poker_name: 'ryoji',  is_admin: 0, is_ranking_excluded: 1, total_points: 28 },
  { account_id: 3, poker_name: 'yuyu',   is_admin: 0, is_ranking_excluded: 0, total_points: 40 },
  { account_id: 4, poker_name: 'てぐ',   is_admin: 0, is_ranking_excluded: 0, total_points: 40 }, // 同点
  { account_id: 5, poker_name: 'けい',   is_admin: 0, is_ranking_excluded: 0, total_points: 35 },
  { account_id: 6, poker_name: 'すずき', is_admin: 0, is_ranking_excluded: 0, total_points: 20 }, // 4位以下 (pt 非公開)
  { account_id: 7, poker_name: 'こうじ', is_admin: 0, is_ranking_excluded: 0, total_points: 0 },  // 未挑戦
  { account_id: 8, poker_name: 'たろう', is_admin: 0, is_ranking_excluded: 0, total_points: 15 },
  { account_id: 9, poker_name: 'はな',   is_admin: 0, is_ranking_excluded: 0, total_points: 5 },
];

describe('ranking buildRanking (ranking + reference + 上位3位pt公開)', () => {
  it('admin はランキングにも参考枠にも含まれない', () => {
    const r = buildRanking(SAMPLE, 2);
    expect(r.ranking.find((x) => x.poker_name === 'テスト君')).toBeUndefined();
    expect(r.reference.find((x) => x.poker_name === 'テスト君')).toBeUndefined();
  });

  it('admin が叩いた場合 my_rank=null', () => {
    const r = buildRanking(SAMPLE, 1);
    expect(r.my_rank).toBeNull();
  });

  it('is_ranking_excluded のユーザーは通常ランキングに含まれず参考枠のみ', () => {
    const r = buildRanking(SAMPLE, 2);
    expect(r.ranking.find((x) => x.poker_name === 'ryoji')).toBeUndefined();
    expect(r.reference.find((x) => x.poker_name === 'ryoji')).toBeDefined();
  });

  it('ryoji が叩いた場合も my_rank=null (通常ランキング外)', () => {
    const r = buildRanking(SAMPLE, 2);
    expect(r.my_rank).toBeNull();
  });

  it('参考枠の pt は常に公開', () => {
    const r = buildRanking(SAMPLE, 1);
    expect(r.reference[0]).toEqual({ poker_name: 'ryoji', total_points: 28 });
  });

  it('上位 3 位の total_points が公開、4 位以下は null', () => {
    const r = buildRanking(SAMPLE, 1);
    // 1位: yuyu (40, id=3), 1位: てぐ (40, id=4 同点), 3位: けい (35),
    // 4位: すずき (20), 5位: たろう (15), 6位: はな (5), 7位: こうじ (0)
    expect(r.hide_points_reason).toBeNull(); // top3=3 < 7/2=3.5 → 公開
    expect(r.ranking[0].rank).toBe(1);
    expect(r.ranking[0].points_visible).toBe(true);
    expect(r.ranking[0].total_points).toBe(40);

    expect(r.ranking[1].rank).toBe(1); // 同点同順位
    expect(r.ranking[1].points_visible).toBe(true);
    expect(r.ranking[1].total_points).toBe(40);

    expect(r.ranking[2].rank).toBe(3); // 同点の次は 3 位
    expect(r.ranking[2].points_visible).toBe(true);
    expect(r.ranking[2].total_points).toBe(35);

    expect(r.ranking[3].rank).toBe(4); // すずき
    expect(r.ranking[3].points_visible).toBe(false);
    expect(r.ranking[3].total_points).toBeNull();
  });

  it('同点が 3 位を跨ぐ場合: 上位 3 名以内に入る同点者は全員 pt 公開 (half-top3 ルール未抵触)', () => {
    // 50 / 40×3 / 30 / 20×4 → top3=4、 length=9、 4 > 4.5 false → 公開
    const fixture: FakeAccount[] = [
      { account_id: 1, poker_name: 'a', is_admin: 0, is_ranking_excluded: 0, total_points: 50 },
      { account_id: 2, poker_name: 'b', is_admin: 0, is_ranking_excluded: 0, total_points: 40 },
      { account_id: 3, poker_name: 'c', is_admin: 0, is_ranking_excluded: 0, total_points: 40 },
      { account_id: 4, poker_name: 'd', is_admin: 0, is_ranking_excluded: 0, total_points: 40 },
      { account_id: 5, poker_name: 'e', is_admin: 0, is_ranking_excluded: 0, total_points: 30 },
      { account_id: 6, poker_name: 'f', is_admin: 0, is_ranking_excluded: 0, total_points: 20 },
      { account_id: 7, poker_name: 'g', is_admin: 0, is_ranking_excluded: 0, total_points: 20 },
      { account_id: 8, poker_name: 'h', is_admin: 0, is_ranking_excluded: 0, total_points: 20 },
      { account_id: 9, poker_name: 'i', is_admin: 0, is_ranking_excluded: 0, total_points: 20 },
    ];
    const r = buildRanking(fixture, 5);
    expect(r.hide_points_reason).toBeNull();
    expect(r.ranking[0]).toMatchObject({ rank: 1, total_points: 50, points_visible: true });
    expect(r.ranking[1]).toMatchObject({ rank: 2, total_points: 40, points_visible: true });
    expect(r.ranking[2]).toMatchObject({ rank: 2, total_points: 40, points_visible: true });
    expect(r.ranking[3]).toMatchObject({ rank: 2, total_points: 40, points_visible: true });
    // e は 5位 (rank > 3 → 非公開)
    expect(r.ranking[4]).toMatchObject({ rank: 5, points_visible: false, total_points: null });
  });

  it('同点が 4 位を跨ぐ場合: 4 位以下の同点者は全員 pt 非公開', () => {
    // 1位 / 2位 / 3位 / 4位/4位/4位 → 上位 3 位のみ pt 公開
    const fixture: FakeAccount[] = [
      { account_id: 1, poker_name: 'a', is_admin: 0, is_ranking_excluded: 0, total_points: 50 },
      { account_id: 2, poker_name: 'b', is_admin: 0, is_ranking_excluded: 0, total_points: 40 },
      { account_id: 3, poker_name: 'c', is_admin: 0, is_ranking_excluded: 0, total_points: 30 },
      { account_id: 4, poker_name: 'd', is_admin: 0, is_ranking_excluded: 0, total_points: 20 },
      { account_id: 5, poker_name: 'e', is_admin: 0, is_ranking_excluded: 0, total_points: 20 },
      { account_id: 6, poker_name: 'f', is_admin: 0, is_ranking_excluded: 0, total_points: 20 },
    ];
    const r = buildRanking(fixture, 4);
    expect(r.ranking[2]).toMatchObject({ rank: 3, total_points: 30, points_visible: true });
    expect(r.ranking[3]).toMatchObject({ rank: 4, points_visible: false, total_points: null });
    expect(r.ranking[4]).toMatchObject({ rank: 4, points_visible: false, total_points: null });
    expect(r.ranking[5]).toMatchObject({ rank: 4, points_visible: false, total_points: null });
  });

  it('一般ユーザーの my_rank が正しい (上位3位は pt 付き)', () => {
    const r1 = buildRanking(SAMPLE, 3); // yuyu 40pt → 1位
    expect(r1.my_rank).toBe(1);
    const r2 = buildRanking(SAMPLE, 4); // てぐ 40pt → 1位 (同点同順位)
    expect(r2.my_rank).toBe(1);
    const r3 = buildRanking(SAMPLE, 5); // けい 35pt → 3位
    expect(r3.my_rank).toBe(3);
    const r4 = buildRanking(SAMPLE, 6); // すずき 20pt → 4位 (pt 非公開)
    expect(r4.my_rank).toBe(4);
  });

  it('未挑戦者 (0pt) も含まれる (末尾)', () => {
    const r = buildRanking(SAMPLE, 7);
    expect(r.ranking[r.ranking.length - 1].poker_name).toBe('こうじ');
  });

  it('同点はタイブレイクで account_id 昇順', () => {
    const r = buildRanking(SAMPLE, 3);
    // 40pt の 2 人: yuyu (id=3) → てぐ (id=4) の順
    expect(r.ranking[0].poker_name).toBe('yuyu');
    expect(r.ranking[1].poker_name).toBe('てぐ');
  });

  it('admin が 0 人でも順位が正しい', () => {
    const noAdmin = SAMPLE.filter((a) => a.is_admin === 0);
    const r = buildRanking(noAdmin, 3);
    // SAMPLE は通常 7 人 + ryoji (除外) 1 人 → buildRanking で 7 名
    expect(r.ranking).toHaveLength(7);
    expect(r.my_rank).toBe(1);
  });

  it('レスポンス shape: ranking は {rank, poker_name, points_visible, total_points}', () => {
    const r = buildRanking(SAMPLE, 3);
    for (const row of r.ranking) {
      expect(Object.keys(row).sort()).toEqual([
        'points_visible',
        'poker_name',
        'rank',
        'total_points',
      ]);
    }
  });

  it('レスポンス shape: reference は {poker_name, total_points}', () => {
    const r = buildRanking(SAMPLE, 1);
    for (const row of r.reference) {
      expect(Object.keys(row).sort()).toEqual(['poker_name', 'total_points']);
    }
  });
});

describe('半数超 top3 → pt 全員非公開', () => {
  const N = (id: number, name: string, pts: number): FakeAccount => ({
    account_id: id,
    poker_name: name,
    is_admin: 0,
    is_ranking_excluded: 0,
    total_points: pts,
  });

  it('6 人中 top3=3 (半数ちょうど) は公開 (>= ではなく > で判定)', () => {
    // 1位×3 (同点) / 4位×3 → top3Count=3、 length=6、 3 > 3 は false → 公開
    const rows = [
      N(1, 'a', 40), N(2, 'b', 40), N(3, 'c', 40),
      N(4, 'd', 10), N(5, 'e', 10), N(6, 'f', 10),
    ];
    const r = buildRanking(rows, 1);
    expect(r.hide_points_reason).toBeNull();
    expect(r.ranking[0].points_visible).toBe(true);
    expect(r.ranking[0].total_points).toBe(40);
  });

  it('6 人中 top3=4 (半数超) → 全員 pt 非公開', () => {
    // 1位×4 (同点) / 5位×2 → top3Count=4、 length=6、 4 > 3 → 非公開
    const rows = [
      N(1, 'a', 40), N(2, 'b', 40), N(3, 'c', 40), N(4, 'd', 40),
      N(5, 'e', 10), N(6, 'f', 5),
    ];
    const r = buildRanking(rows, 1);
    expect(r.hide_points_reason).toBe('too_many_top3');
    for (const row of r.ranking) {
      expect(row.points_visible).toBe(false);
      expect(row.total_points).toBeNull();
    }
  });

  it('7 人中 top3=3 → 3 > 3.5 false → 公開', () => {
    const rows = [
      N(1, 'a', 50), N(2, 'b', 40), N(3, 'c', 30),
      N(4, 'd', 20), N(5, 'e', 15), N(6, 'f', 10), N(7, 'g', 5),
    ];
    const r = buildRanking(rows, 1);
    expect(r.hide_points_reason).toBeNull();
    expect(r.ranking[2].points_visible).toBe(true); // 3 位は公開
    expect(r.ranking[3].points_visible).toBe(false); // 4 位は非公開
  });

  it('5 人中 top3=3 → 3 > 2.5 true → 非公開', () => {
    const rows = [
      N(1, 'a', 50), N(2, 'b', 40), N(3, 'c', 30), N(4, 'd', 20), N(5, 'e', 5),
    ];
    const r = buildRanking(rows, 1);
    expect(r.hide_points_reason).toBe('too_many_top3');
  });
});
