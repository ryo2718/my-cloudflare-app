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
