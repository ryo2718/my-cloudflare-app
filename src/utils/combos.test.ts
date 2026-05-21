import { describe, it, expect } from 'vitest';
import {
  handAt,
  combosOfHand,
  comboAtSuits,
  allComboKeys,
  comboKeyOf,
  TOTAL_COMBOS,
} from './combos';
import { stringToCard } from '../types/card';

describe('combos: 169 ハンド ↔ 1326 コンボ', () => {
  it('handAt: 対角=ペア / 右上=スーテッド / 左下=オフスート', () => {
    expect(handAt(0, 0)).toMatchObject({ kind: 'pair', label: 'AA', hi: 'A', lo: 'A' });
    expect(handAt(0, 1)).toMatchObject({ kind: 'suited', label: 'AKs', hi: 'A', lo: 'K' });
    expect(handAt(1, 0)).toMatchObject({ kind: 'offsuit', label: 'AKo', hi: 'A', lo: 'K' });
    expect(handAt(12, 12)).toMatchObject({ kind: 'pair', label: '22' });
    expect(handAt(12, 11)).toMatchObject({ kind: 'offsuit', label: '32o', hi: '3', lo: '2' });
  });

  it('コンボ数: pair=6 / suited=4 / offsuit=12', () => {
    expect(combosOfHand(handAt(0, 0)).length).toBe(6);
    expect(combosOfHand(handAt(0, 1)).length).toBe(4);
    expect(combosOfHand(handAt(1, 0)).length).toBe(12);
  });

  it('全コンボは 1326 種で重複なし', () => {
    const all = allComboKeys();
    expect(all.length).toBe(TOTAL_COMBOS);
    expect(new Set(all).size).toBe(TOTAL_COMBOS);
  });

  it('comboAtSuits: pair 上三角6 / suited 対角4 / offsuit 12', () => {
    const count = (h: ReturnType<typeof handAt>) => {
      let n = 0;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (comboAtSuits(h, r, c)) n++;
      return n;
    };
    expect(count(handAt(0, 0))).toBe(6); // AA
    expect(count(handAt(0, 1))).toBe(4); // AKs
    expect(count(handAt(1, 0))).toBe(12); // AKo
  });

  it('comboKeyOf は順序非依存で一意', () => {
    const a = stringToCard('Ah')!;
    const b = stringToCard('Ks')!;
    expect(comboKeyOf(a, b)).toBe(comboKeyOf(b, a));
  });
});
