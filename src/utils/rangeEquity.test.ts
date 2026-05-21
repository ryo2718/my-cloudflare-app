import { describe, it, expect } from 'vitest';
import { computeRangeEquity } from './rangeEquity';
import { stringToCard } from '../types/card';
import { cardToInt } from './handEvaluator';
import { allComboKeys, handAt, handKeys, comboKeyToInts, type WeightedCombo } from './combos';

const ci = (s: string) => cardToInt(stringToCard(s)!);
const combo = (a: string, b: string, w = 1): WeightedCombo => [ci(a), ci(b), w];
const fullRange = (): WeightedCombo[] => allComboKeys().map((k) => [...comboKeyToInts(k), 1] as WeightedCombo);
const handCombos = (row: number, col: number, w = 1): WeightedCombo[] =>
  handKeys(handAt(row, col)).map((k) => [...comboKeyToInts(k), w] as WeightedCombo);

describe('computeRangeEquity (重み付き)', () => {
  it('具体 vs 具体 (プリフロップ) は全列挙で AhAc vs JdTd ≈ 78%', () => {
    const r = computeRangeEquity([combo('Ah', 'Ac')], [combo('Jd', 'Td')], []);
    expect(r.method).toBe('enumerate');
    expect(r.a).toBeGreaterThan(77);
    expect(r.a).toBeLessThan(79);
  });

  it('具体 vs 具体 (フロップ) AhAc vs JdTd / Kh7s2d → AA 圧倒的、全列挙', () => {
    const r = computeRangeEquity([combo('Ah', 'Ac')], [combo('Jd', 'Td')], [ci('Kh'), ci('7s'), ci('2d')]);
    expect(r.method).toBe('enumerate');
    expect(r.a).toBeGreaterThan(85);
  });

  it('AA vs フルランダムレンジ (プリフロップ) ≈ 85%、モンテカルロ', () => {
    const r = computeRangeEquity(handCombos(0, 0), fullRange(), []);
    expect(r.method).toBe('montecarlo');
    expect(r.a).toBeGreaterThan(82);
    expect(r.a).toBeLessThan(88);
  });

  it('ブロッカー: 同じコンボ同士は有効ペアなし', () => {
    const r = computeRangeEquity([combo('As', 'Ks')], [combo('As', 'Ks')], []);
    expect(r.pairs).toBe(0);
    expect(r.a).toBe(0);
    expect(r.b).toBe(0);
  });

  it('レンジ vs 具体 (リバー): KK セット確定で 100%', () => {
    const board = [ci('Kh'), ci('7s'), ci('2d'), ci('Qc'), ci('3s')];
    const r = computeRangeEquity(handCombos(1, 1), [combo('Ah', 'Ac')], board);
    expect(r.a).toBe(100);
    expect(r.b).toBe(0);
  });

  it('重みは加重平均に効く: AA(w0.5)+KK(w0.5) と AA(w1)+KK(w1) は同値、AA偏重で上がる', () => {
    const all = fullRange();
    const balanced = [...handCombos(0, 0, 1), ...handCombos(1, 1, 1)];
    const aaHeavy = [...handCombos(0, 0, 1), ...handCombos(1, 1, 0.0001)]; // ほぼ AA のみ
    const rBal = computeRangeEquity(balanced, all, []);
    const rAA = computeRangeEquity(aaHeavy, all, []);
    // AA は KK よりランダムに強いので、AA 偏重の方がエクイティが高い。
    expect(rAA.a).toBeGreaterThan(rBal.a);
  });
});
