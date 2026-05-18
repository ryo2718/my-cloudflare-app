import { describe, expect, it } from 'vitest';
import { judgmentColor, judgmentIcon } from './judgmentIcon';

describe('judgmentIcon (中級スコアの記号判定)', () => {
  it('+2pt → ◎', () => expect(judgmentIcon(2)).toBe('◎'));
  it('+1pt → ○', () => expect(judgmentIcon(1)).toBe('○'));
  it('0pt → △', () => expect(judgmentIcon(0)).toBe('△'));
  it('-1pt → ×', () => expect(judgmentIcon(-1)).toBe('×'));
  it('+3pt 以上 (理論上ない) → ◎ にクランプ', () => expect(judgmentIcon(3)).toBe('◎'));
  it('-2pt 以下 (理論上ない) → × にクランプ', () => expect(judgmentIcon(-2)).toBe('×'));
});

describe('judgmentColor', () => {
  it('スコアに応じて色が違う', () => {
    const cols = new Set([
      judgmentColor(2),
      judgmentColor(1),
      judgmentColor(0),
      judgmentColor(-1),
    ]);
    expect(cols.size).toBe(4);
  });
});
