// フロップ中級のベットサイズ配色: 6色ランプ (check緑/33アンバー/50コーラル/75赤/125濃赤/ALLIN紫)。

import { describe, it, expect } from 'vitest';
import { flopCbColor, flopCbLabel, flopSizeColor, FLOP_SIZE_COLORS } from './flopCbChoiceStyle';

describe('flopSizeColor (6色ランプ)', () => {
  it('各サイズが規定の色', () => {
    expect(flopSizeColor('check')).toBe('#3B8A1E');
    expect(flopSizeColor('33')).toBe('#EF9F27');
    expect(flopSizeColor('50')).toBe('#D85A30');
    expect(flopSizeColor('75')).toBe('#E24B4A');
    expect(flopSizeColor('125')).toBe('#A32D2D');
    expect(flopSizeColor('ALLIN')).toBe('#534AB7');
  });
  it('6色すべて異なる (隣接サイズで見分け可能)', () => {
    const vals = Object.values(FLOP_SIZE_COLORS);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe('flopCbColor (選択肢ボタンの枠/チップ=ランプ色)', () => {
  it('check=緑 / ALLIN=紫', () => {
    expect(flopCbColor('check').border).toBe('#3B8A1E');
    expect(flopCbColor('ALLIN').border).toBe('#534AB7');
  });
  it('ベットの枠線・チェックボックスはランプ色 (33→アンバー / 75→赤 / 125→濃赤)', () => {
    expect(flopCbColor('33').border).toBe('#EF9F27');
    expect(flopCbColor('33').check).toBe('#EF9F27');
    expect(flopCbColor('75').border).toBe('#E24B4A');
    expect(flopCbColor('125').border).toBe('#A32D2D');
  });
});

describe('flopCbLabel', () => {
  it('チェック / ベット% / オールイン', () => {
    expect(flopCbLabel('check')).toBe('チェック');
    expect(flopCbLabel('50')).toBe('ベット50%');
    expect(flopCbLabel('ALLIN')).toBe('オールイン');
  });
});
