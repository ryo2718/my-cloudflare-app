// フロップ即時FB: ベット表示(bet/pot %) + バー色(check=緑/赤グラデ/紫)。

import { describe, it, expect } from 'vitest';
import { actionFreqLabel, barColor } from './flopFeedbackFormat';
import { ACTION_COLOR } from '../../styles/actionColors';

describe('actionFreqLabel (修正1: bet/pot %)', () => {
  it('ベットは bet/pot の % で表示', () => {
    expect(actionFreqLabel('R1.8', 0.327)).toBe('ベット 33%');
    expect(actionFreqLabel('R2.75', 0.5)).toBe('ベット 50%');
    expect(actionFreqLabel('R4.1', 0.745)).toBe('ベット 75%');
  });
  it('チェック / オールイン', () => {
    expect(actionFreqLabel('X', 0)).toBe('チェック');
    expect(actionFreqLabel('RAI', 2.0)).toBe('オールイン');
  });
});

describe('barColor (修正2: check=緑 / 赤グラデ / 紫)', () => {
  it('チェックは緑 (= ACTION_COLOR.check = call と同色)', () => {
    expect(barColor('X', 0)).toBe(ACTION_COLOR.check);
    expect(ACTION_COLOR.check).toBe('#3B8A1E');
  });
  it('ポットオーバー (>100%) は紫', () => {
    expect(barColor('R12', 1.2)).toBe(ACTION_COLOR.allin);
    expect(barColor('RAI', 2.0)).toBe(ACTION_COLOR.allin);
  });
  it('通常ベットは赤系 (サイズで濃淡)', () => {
    const small = barColor('R1.8', 0.33);
    const large = barColor('R5', 0.95);
    expect(small).toMatch(/^hsl\(2,/); // 赤系
    expect(large).toMatch(/^hsl\(2,/);
    expect(small).not.toBe(large); // サイズで濃淡が変わる
  });
});
