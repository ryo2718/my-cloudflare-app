import { describe, expect, it } from 'vitest';
import { judgmentColor, judgmentIcon, judgmentStyle } from './judgmentIcon';
import { getSymbolStyle } from '../../utils/strategySymbol';

describe('judgmentIcon (中級スコアの記号判定)', () => {
  it('+2pt → ◎', () => expect(judgmentIcon(2)).toBe('◎'));
  it('+1pt → ○', () => expect(judgmentIcon(1)).toBe('○'));
  it('0pt → △', () => expect(judgmentIcon(0)).toBe('△'));
  it('-1pt → ✕ (U+2715、既存 strategySymbol と統一)', () => {
    expect(judgmentIcon(-1)).toBe('✕');
  });
  it('+3pt 以上 (理論上ない) → ◎ にクランプ', () => expect(judgmentIcon(3)).toBe('◎'));
  it('-2pt 以下 (理論上ない) → ✕ にクランプ', () => expect(judgmentIcon(-2)).toBe('✕'));
});

describe('judgmentColor (既存 getSymbolStyle と一致)', () => {
  it('+2 → ◎ の symbolColor', () => {
    expect(judgmentColor(2)).toBe(getSymbolStyle('◎').symbolColor);
  });
  it('+1 → ○ の symbolColor', () => {
    expect(judgmentColor(1)).toBe(getSymbolStyle('○').symbolColor);
  });
  it('0 → △ の symbolColor', () => {
    expect(judgmentColor(0)).toBe(getSymbolStyle('△').symbolColor);
  });
  it('-1 → ✕ の symbolColor', () => {
    expect(judgmentColor(-1)).toBe(getSymbolStyle('✕').symbolColor);
  });
});

describe('judgmentStyle (枠 + 記号色 + ラベル色)', () => {
  it('スコア毎に 3 色返す', () => {
    const s = judgmentStyle(2);
    expect(s).toHaveProperty('symbol');
    expect(s).toHaveProperty('border');
    expect(s).toHaveProperty('label');
  });
});
