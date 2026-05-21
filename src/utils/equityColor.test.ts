import { describe, it, expect } from 'vitest';
import { equityOutcome } from './equityColor';

describe('equityOutcome (勝敗の色分け判定)', () => {
  it('A > B のとき A=win / B=lose', () => {
    expect(equityOutcome(60, 40, 'a')).toBe('win');
    expect(equityOutcome(60, 40, 'b')).toBe('lose');
  });

  it('A < B のとき A=lose / B=win', () => {
    expect(equityOutcome(40, 60, 'a')).toBe('lose');
    expect(equityOutcome(40, 60, 'b')).toBe('win');
  });

  it('丸め後に同値なら両者 tie', () => {
    expect(equityOutcome(50, 50, 'a')).toBe('tie');
    expect(equityOutcome(50, 50, 'b')).toBe('tie');
    // 浮動小数点誤差: 小数1桁で丸めると 50.0 同士。
    expect(equityOutcome(50.04, 49.96, 'a')).toBe('tie');
    expect(equityOutcome(50.04, 49.96, 'b')).toBe('tie');
  });

  it('丸め後に差があれば勝敗が付く', () => {
    expect(equityOutcome(50.05, 49.95, 'a')).toBe('win'); // 50.1 vs 50.0 で差が付く
    expect(equityOutcome(50.05, 49.95, 'b')).toBe('lose');
  });
});
