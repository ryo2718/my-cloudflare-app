// フロップ中級CB 選択肢の配色: check=緑 / ALLIN=紫 / ベットはサイズで濃淡 (頻度バーと一貫)。

import { describe, it, expect } from 'vitest';
import { flopCbColor, flopCbLabel } from './flopCbChoiceStyle';
import { barColor } from './flopFeedbackFormat';
import { ACTION_COLOR } from '../../styles/actionColors';

const lightnessOf = (hsl: string): number => Number(/(\d+)%\)$/.exec(hsl)?.[1] ?? -1);

describe('flopCbColor', () => {
  it('check は緑 (ACTION_COLOR.check)', () => {
    expect(flopCbColor('check').border).toBe(ACTION_COLOR.check);
  });
  it('ALLIN は紫 (ACTION_COLOR.allin)', () => {
    expect(flopCbColor('ALLIN').border).toBe(ACTION_COLOR.allin);
  });
  it('125% (ポットオーバー) は紫', () => {
    expect(flopCbColor('125').border).toBe(ACTION_COLOR.allin);
  });
  it('ベット色は頻度バー (barColor) と同色', () => {
    expect(flopCbColor('33').border).toBe(barColor('R', 0.33));
    expect(flopCbColor('50').border).toBe(barColor('R', 0.5));
    expect(flopCbColor('75').border).toBe(barColor('R', 0.75));
  });
  it('サイズが大きいほど濃い (明度が下がる)', () => {
    const l20 = lightnessOf(flopCbColor('20').border);
    const l50 = lightnessOf(flopCbColor('50').border);
    const l75 = lightnessOf(flopCbColor('75').border);
    expect(l20).toBeGreaterThan(l50);
    expect(l50).toBeGreaterThan(l75);
  });
  it('チェックボックス(check 色)も枠線と同じサイズ色', () => {
    expect(flopCbColor('75').check).toBe(flopCbColor('75').border);
  });
});

describe('flopCbLabel', () => {
  it('チェック / ベット% / オールイン', () => {
    expect(flopCbLabel('check')).toBe('チェック');
    expect(flopCbLabel('33')).toBe('ベット33%');
    expect(flopCbLabel('ALLIN')).toBe('オールイン');
  });
});
