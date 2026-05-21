import { describe, it, expect } from 'vitest';
import { computeRangeEquity } from './rangeEquity';
import { stringToCard } from '../types/card';
import { cardToInt } from './handEvaluator';
import { allComboKeys, handAt, handKeys, comboKeyToInts } from './combos';

const ci = (s: string) => cardToInt(stringToCard(s)!);
const combo = (a: string, b: string): [number, number] => [ci(a), ci(b)];

describe('computeRangeEquity', () => {
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
    const aa = handKeys(handAt(0, 0)).map(comboKeyToInts); // AA 6 コンボ
    const all = allComboKeys().map(comboKeyToInts); // 1326 コンボ
    const r = computeRangeEquity(aa, all, []);
    expect(r.method).toBe('montecarlo');
    expect(r.a).toBeGreaterThan(82);
    expect(r.a).toBeLessThan(88);
  });

  it('ブロッカー: 同じコンボ同士は有効ペアなし (pairs=0)', () => {
    const r = computeRangeEquity([combo('As', 'Ks')], [combo('As', 'Ks')], []);
    expect(r.pairs).toBe(0);
    expect(r.a).toBe(0);
    expect(r.b).toBe(0);
  });

  it('レンジ vs 具体 (リバー確定) は妥当: KK vs ボードでセット確定の具体ハンド', () => {
    // ボード Kh 7s 2d Qc 3s。A=KK(残コンボ) vs B=AhAc。A はセット確定で 100%。
    const board = [ci('Kh'), ci('7s'), ci('2d'), ci('Qc'), ci('3s')];
    const kk = handKeys(handAt(1, 1)).map(comboKeyToInts); // KK 6 コンボ (Kh は盤上なので除外される)
    const r = computeRangeEquity(kk, [combo('Ah', 'Ac')], board);
    expect(r.a).toBe(100);
    expect(r.b).toBe(0);
  });
});
