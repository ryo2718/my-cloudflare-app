import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeBoard, applyFilter, type RoleGroup } from './handFilter';
import { rangeFromNode } from './presetRange';
import { comboKeyOf } from './combos';
import { stringToCard } from '../types/card';
import { cardToInt } from './handEvaluator';

const ci = (s: string) => cardToInt(stringToCard(s)!);
const k = (a: string, b: string) => comboKeyOf(stringToCard(a)!, stringToCard(b)!);
// ボード: Kd Jd 2d Jh 4s (JJ ペア + ダイヤ3枚)。
const BOARD = ['Kd', 'Jd', '2d', 'Jh', '4s'].map(ci);
const loadUtg = () =>
  rangeFromNode(
    JSON.parse(
      readFileSync(
        join(process.cwd(), 'public/data/preflop/cash_100bb_6max_nl500_2.5x/utg.json'),
        'utf8',
      ),
    ),
  );

const roleByKey = (groups: RoleGroup[], key: string) => groups.find((g) => g.key === key);

describe('handFilter: ボード Kd Jd 2d Jh 4s + UTG オープンレンジ', () => {
  const groups = analyzeBoard(loadUtg(), BOARD);
  const keys = groups.map((g) => g.key);

  it('成立役は quads/fullhouse/flush/trips/twopair/pair、straight・high は含まない', () => {
    expect(keys).toEqual(expect.arrayContaining(['quads', 'fullhouse', 'flush', 'trips', 'twopair', 'pair']));
    expect(keys).not.toContain('straight');
    expect(keys).not.toContain('high');
  });

  it('強い順に並ぶ', () => {
    const order = ['quads', 'fullhouse', 'flush', 'straight', 'trips', 'twopair', 'pair', 'high'];
    const idx = keys.map((kk) => order.indexOf(kk));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it('フルハウス内訳に "KKK JJ" を含み "JJJ 22" は含まない (J2 不在)', () => {
    const fh = roleByKey(groups, 'fullhouse')!;
    const labels = fh.items.map((it) => it.label);
    expect(labels).toContain('KKK JJ');
    expect(labels).not.toContain('JJJ 22');
  });

  it('フラッシュ内訳は3階層 (高さ → 具体コンボ)', () => {
    const fl = roleByKey(groups, 'flush')!;
    expect(fl.items.length).toBeGreaterThan(0);
    expect(fl.items[0].children).toBeDefined();
    expect(fl.items[0].children!.length).toBeGreaterThan(0);
  });

  it('ボード衝突: Kd を含むコンボは全役から除外', () => {
    const allCombos = groups.flatMap((g) => g.combos);
    expect(allCombos.some((key) => key.includes('Kd'))).toBe(false);
  });
});

describe('handFilter: 適用 (置き換え / 和集合 / スート単位)', () => {
  // AdQd=フラッシュ, AhQh=ワンペア(JJ), AsAc=ツーペア(AA+JJ), Th9c=ワンペア(JJ)
  const range = new Map<string, number>([
    [k('Ad', 'Qd'), 1],
    [k('Ah', 'Qh'), 1],
    [k('As', 'Ac'), 1],
    [k('Th', '9c'), 1],
  ]);
  const groups = analyzeBoard(range, BOARD);

  it('スート単位: フラッシュは AdQd のみ (AhQh は含まない)', () => {
    const fl = roleByKey(groups, 'flush')!;
    expect(fl.combos).toEqual([k('Ad', 'Qd')]);
  });

  it('複数役オンは和集合、かつ置き換え (非該当コンボは落ちる)', () => {
    const fl = roleByKey(groups, 'flush')!;
    const tp = roleByKey(groups, 'twopair')!;
    const keys = new Set<string>([...fl.combos, ...tp.combos]);
    const result = applyFilter(range, keys);
    expect(new Set(result.keys())).toEqual(new Set([k('Ad', 'Qd'), k('As', 'Ac')]));
    // 置き換え: range にあった Th9c / AhQh は落ちる。
    expect(result.has(k('Th', '9c'))).toBe(false);
    expect(result.has(k('Ah', 'Qh'))).toBe(false);
  });

  it('適用結果はスート単位の4文字キー、weight は引き継ぐ', () => {
    const fl = roleByKey(groups, 'flush')!;
    const result = applyFilter(range, new Set(fl.combos));
    for (const key of result.keys()) expect(key.length).toBe(4);
    expect(result.get(k('Ad', 'Qd'))).toBe(1);
  });
});

describe('handFilter: ストレート内訳 (全ての成立ストレート)', () => {
  // ボード 9 6 3 4 7 (スート混在、フラッシュ無し)。
  const SBOARD = ['9h', '6c', '3d', '4s', '7d'].map(ci);

  it('85s は 7/8/9 ハイ全てに計上、T8s は T ハイ、A5s は 7 ハイ', () => {
    const range = new Map<string, number>([
      [k('8c', '5c'), 1], // 85s -> 3-4-5-6-7 / 4-5-6-7-8 / 5-6-7-8-9
      [k('Tc', '8c'), 1], // T8s -> 6-7-8-9-T
      [k('Ac', '5c'), 1], // A5s -> 3-4-5-6-7
    ]);
    const st = analyzeBoard(range, SBOARD).find((g) => g.key === 'straight')!;
    const byLabel = (l: string) => st.items.find((it) => it.label === l);
    expect(st.items.map((it) => it.label)).toEqual(
      expect.arrayContaining(['T ハイ', '9 ハイ', '8 ハイ', '7 ハイ']),
    );
    // 85s は 3 つのハイ全てに出る。
    expect(byLabel('9 ハイ')!.combos).toContain(k('8c', '5c'));
    expect(byLabel('8 ハイ')!.combos).toContain(k('8c', '5c'));
    expect(byLabel('7 ハイ')!.combos).toContain(k('8c', '5c'));
    // T8s は T ハイのみ。
    expect(byLabel('T ハイ')!.combos).toContain(k('Tc', '8c'));
    expect(byLabel('9 ハイ')!.combos).not.toContain(k('Tc', '8c'));
  });

  it('ストレートが成立しないボード (K J 2 J 4) はストレート役なし', () => {
    const range = new Map<string, number>([[k('As', 'Ac'), 1], [k('Th', '9c'), 1]]);
    expect(analyzeBoard(range, BOARD).find((g) => g.key === 'straight')).toBeUndefined();
  });

  it('A-2-3-4 + 5 はホイール (5 ハイ) として検出', () => {
    const wheelBoard = ['Ah', '2c', '3d', '4s', 'Kd'].map(ci);
    const range = new Map<string, number>([[k('5c', '9c'), 1]]);
    const st = analyzeBoard(range, wheelBoard).find((g) => g.key === 'straight')!;
    expect(st.items.map((it) => it.label)).toContain('5 ハイ');
  });
});

describe('handFilter: 相手の確定ハンド除外 (exclude)', () => {
  // AsAc=ツーペア(AA+JJ), AhQh=ワンペア, Th9c=ワンペア。相手が As・Qh を持つ想定。
  const range = new Map<string, number>([
    [k('As', 'Ac'), 1],
    [k('Ah', 'Qh'), 1],
    [k('Th', '9c'), 1],
  ]);

  it('exclude に相手の確定ハンドを渡すと、そのカードを含むコンボが消える', () => {
    const exclude = new Set([ci('As'), ci('Qh')]);
    const groups = analyzeBoard(range, BOARD, exclude);
    const all = groups.flatMap((g) => g.combos);
    // As を含む AsAc、Qh を含む AhQh は除外。Th9c は残る。
    expect(all).not.toContain(k('As', 'Ac'));
    expect(all).not.toContain(k('Ah', 'Qh'));
    expect(all).toContain(k('Th', '9c'));
  });

  it('exclude 無し / 空 (相手がレンジ・未設定) では何も除外しない', () => {
    const without = analyzeBoard(range, BOARD).flatMap((g) => g.combos);
    const empty = analyzeBoard(range, BOARD, new Set<number>()).flatMap((g) => g.combos);
    expect(new Set(without)).toEqual(new Set(empty));
    expect(without).toContain(k('As', 'Ac'));
    expect(without).toContain(k('Ah', 'Qh'));
  });

  it('ボード衝突カードと相手の確定ハンドの両方が同時に除外される', () => {
    // Kd はボード上 → AdKd 等が除外。相手 As → AsAc が除外。
    const range2 = new Map<string, number>([
      [k('Ad', 'Kd'), 1], // Kd はボード衝突
      [k('As', 'Ac'), 1], // As は相手の確定ハンド
      [k('Th', '9c'), 1], // 残る
    ]);
    const all = analyzeBoard(range2, BOARD, new Set([ci('As')])).flatMap((g) => g.combos);
    expect(all).not.toContain(k('Ad', 'Kd'));
    expect(all).not.toContain(k('As', 'Ac'));
    expect(all).toContain(k('Th', '9c'));
  });
});
