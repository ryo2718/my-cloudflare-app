import { describe, it, expect } from 'vitest';
import { computeEquity } from './equity';
import { stringToCard, type Card } from '../types/card';

function pair(a: string, b: string): [Card, Card] {
  const c1 = stringToCard(a)!;
  const c2 = stringToCard(b)!;
  return [c1, c2];
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
