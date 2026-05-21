import { describe, it, expect } from 'vitest';
import { computeEquity } from './equity';
import { stringToCard, type Card } from '../types/card';

function pair(a: string, b: string): [Card, Card] {
  const c1 = stringToCard(a)!;
  const c2 = stringToCard(b)!;
  return [c1, c2];
}

function board(...cs: string[]): Card[] {
  return cs.map((s) => stringToCard(s)!);
}

describe('computeEquity (全列挙)', () => {
  it('AhAc vs JdTd → 約 78.2% / 21.8% (全列挙の正確値)', () => {
    const r = computeEquity(pair('Ah', 'Ac'), pair('Jd', 'Td'));
    expect(r.total).toBe(1712304); // C(48,5)
    expect(r.a + r.b).toBeCloseTo(100, 5);
    expect(r.a).toBeGreaterThan(77.7); // 実測 78.28
    expect(r.a).toBeLessThan(78.7);
  });

  it('AKs vs QQ → 約 46% / 54%', () => {
    const r = computeEquity(pair('As', 'Ks'), pair('Qd', 'Qc'));
    expect(r.a).toBeGreaterThan(45); // 実測 46.21
    expect(r.a).toBeLessThan(47.5);
    expect(r.b).toBeGreaterThan(52.5);
    expect(r.b).toBeLessThan(55);
  });
});

describe('computeEquity (ボード対応)', () => {
  it('フロップ: AhAc vs JdTd, board Kh7s2d → AA 圧倒的有利、total=C(45,2)=990', () => {
    const r = computeEquity(pair('Ah', 'Ac'), pair('Jd', 'Td'), board('Kh', '7s', '2d'));
    expect(r.total).toBe(990);
    expect(r.a + r.b).toBeCloseTo(100, 5);
    expect(r.a).toBeGreaterThan(85);
  });

  it('ターン: AhAc vs JdTd, board Kh7s2dQc → total=44, AA 有利', () => {
    const r = computeEquity(pair('Ah', 'Ac'), pair('Jd', 'Td'), board('Kh', '7s', '2d', 'Qc'));
    expect(r.total).toBe(44);
    expect(r.a + r.b).toBeCloseTo(100, 5);
    expect(r.a).toBeGreaterThan(75);
  });

  it('リバー: 役確定で 100/0、total=1', () => {
    const r = computeEquity(pair('Ah', 'Ac'), pair('Jd', 'Td'), board('Kh', '7s', '2d', 'Qc', '3s'));
    expect(r.total).toBe(1);
    expect(r.a).toBe(100);
    expect(r.b).toBe(0);
    expect(r.tie).toBe(0);
  });

  it('リバー: ボードでロイヤルが成立 → 引き分け 50/50、total=1', () => {
    const r = computeEquity(pair('2c', '3d'), pair('2s', '3h'), board('Ah', 'Kh', 'Qh', 'Jh', 'Th'));
    expect(r.total).toBe(1);
    expect(r.a).toBe(50);
    expect(r.b).toBe(50);
    expect(r.tie).toBe(100);
  });
});

// 同じハンド (AhAc vs JdTd) でボードを進めたときの勝率変化を全列挙で検証。
// フロップ → ターンで JdTd がフルハウスに化けて逆転し、リバーで AhAc が上のフルハウスで決着。
describe('equity with board cards (段階別の正確値)', () => {
  it('フロップ Qc Qd Tc: AhAc(AAQQ) vs JdTd(QQTT) → A ≈ 85.2 / B ≈ 14.8', () => {
    const r = computeEquity(pair('Ah', 'Ac'), pair('Jd', 'Td'), board('Qc', 'Qd', 'Tc'));
    expect(r.a).toBeCloseTo(85.2, 0);
    expect(r.b).toBeCloseTo(14.8, 0);
  });

  it('ターン Qc Qd Tc Ts: JdTd がフルハウス(TTTQQ)で逆転 → A ≈ 9.09 / B ≈ 90.9', () => {
    const r = computeEquity(pair('Ah', 'Ac'), pair('Jd', 'Td'), board('Qc', 'Qd', 'Tc', 'Ts'));
    expect(r.a).toBeCloseTo(9.09, 1);
    expect(r.b).toBeCloseTo(90.9, 1);
  });

  it('リバー Qc Qd Tc Ts As: AhAc が上のフルハウス(AAAQQ)で勝ち → A=100 / B=0', () => {
    const r = computeEquity(pair('Ah', 'Ac'), pair('Jd', 'Td'), board('Qc', 'Qd', 'Tc', 'Ts', 'As'));
    expect(r.a).toBe(100);
    expect(r.b).toBe(0);
  });
});
