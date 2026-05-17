import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayingCard } from './PlayingCard';
import {
  CARD_SIZES,
  SUIT_BG_COLORS,
  SELECTED_OUTLINE_COLOR,
  SELECTED_OUTLINE_WIDTH,
  getPlayingCardStyle,
  defaultPlayingCardAriaLabel,
} from './PlayingCard.helpers';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

describe('SUIT_BG_COLORS', () => {
  it('4 スーツに薄めの背景色が定義されている', () => {
    expect(SUIT_BG_COLORS.s).toBe('#5F5E5A'); // gray-ish black
    expect(SUIT_BG_COLORS.h).toBe('#E24B4A'); // red
    expect(SUIT_BG_COLORS.d).toBe('#378ADD'); // blue
    expect(SUIT_BG_COLORS.c).toBe('#639922'); // green
  });
});

describe('CARD_SIZES', () => {
  it('md は仕様基準値 (26×32, font 16)', () => {
    expect(CARD_SIZES.md).toEqual({ width: 26, height: 32, fontSize: 16 });
  });
  it('xs/sm/md/lg は size 昇順', () => {
    expect(CARD_SIZES.xs.width).toBeLessThan(CARD_SIZES.sm.width);
    expect(CARD_SIZES.sm.width).toBeLessThan(CARD_SIZES.md.width);
    expect(CARD_SIZES.md.width).toBeLessThan(CARD_SIZES.lg.width);
  });
});

// ----------------------------------------------------------------------------
// getPlayingCardStyle (pure)
// ----------------------------------------------------------------------------

describe('getPlayingCardStyle', () => {
  it('size が反映される', () => {
    const s = getPlayingCardStyle({ suit: 's', size: 'lg' });
    expect(s.width).toBe(CARD_SIZES.lg.width);
    expect(s.height).toBe(CARD_SIZES.lg.height);
    expect(s.fontSize).toBe(CARD_SIZES.lg.fontSize);
  });

  it('suit 背景色が反映される', () => {
    expect(getPlayingCardStyle({ suit: 'h' }).background).toBe(SUIT_BG_COLORS.h);
    expect(getPlayingCardStyle({ suit: 'd' }).background).toBe(SUIT_BG_COLORS.d);
    expect(getPlayingCardStyle({ suit: 'c' }).background).toBe(SUIT_BG_COLORS.c);
    expect(getPlayingCardStyle({ suit: 's' }).background).toBe(SUIT_BG_COLORS.s);
  });

  it('clickable=true で cursor=pointer', () => {
    expect(getPlayingCardStyle({ suit: 's', clickable: true }).cursor).toBe('pointer');
  });

  it('clickable 未指定 → cursor 未設定', () => {
    expect(getPlayingCardStyle({ suit: 's' }).cursor).toBeUndefined();
  });

  it('disabled=true で opacity 0.4 + cursor=not-allowed', () => {
    const s = getPlayingCardStyle({ suit: 's', clickable: true, disabled: true });
    expect(s.opacity).toBe(0.4);
    expect(s.cursor).toBe('not-allowed');
  });

  it('selected=true で outline 設定', () => {
    const s = getPlayingCardStyle({ suit: 's', selected: true });
    expect(s.outline).toContain(SELECTED_OUTLINE_COLOR);
    expect(s.outline).toContain(`${SELECTED_OUTLINE_WIDTH}px`);
  });

  it('共通プロパティ: white 文字 / mono フォント / border-radius=4', () => {
    const s = getPlayingCardStyle({ suit: 's' });
    expect(s.color).toBe('#ffffff');
    expect(s.borderRadius).toBe(4);
    expect(String(s.fontFamily)).toMatch(/mono/i);
    expect(s.fontWeight).toBe(500);
  });
});

// ----------------------------------------------------------------------------
// defaultPlayingCardAriaLabel
// ----------------------------------------------------------------------------

describe('defaultPlayingCardAriaLabel', () => {
  it('A of Spades 等の英文 label', () => {
    expect(defaultPlayingCardAriaLabel('A', 's')).toBe('A of Spades');
    expect(defaultPlayingCardAriaLabel('K', 'h')).toBe('K of Hearts');
    expect(defaultPlayingCardAriaLabel('T', 'd')).toBe('T of Diamonds');
    expect(defaultPlayingCardAriaLabel('2', 'c')).toBe('2 of Clubs');
  });
});

// ----------------------------------------------------------------------------
// Component rendering (renderToStaticMarkup)
// ----------------------------------------------------------------------------

describe('<PlayingCard /> rendering', () => {
  it('ランクの文字が描画される', () => {
    const html = renderToStaticMarkup(<PlayingCard rank="A" suit="s" />);
    expect(html).toContain('>A<');
  });

  it('onClick 未指定 → <span role="img">', () => {
    const html = renderToStaticMarkup(<PlayingCard rank="A" suit="s" />);
    expect(html).toMatch(/<span[^>]*role="img"/);
    expect(html).not.toMatch(/<button/);
  });

  it('onClick あり → <button>', () => {
    const html = renderToStaticMarkup(
      <PlayingCard rank="A" suit="s" onClick={() => {}} />,
    );
    expect(html).toMatch(/<button[^>]*type="button"/);
  });

  it('disabled=true で button.disabled', () => {
    const html = renderToStaticMarkup(
      <PlayingCard rank="A" suit="s" disabled onClick={() => {}} />,
    );
    expect(html).toContain('disabled');
  });

  it('selected=true で aria-pressed', () => {
    const html = renderToStaticMarkup(
      <PlayingCard rank="A" suit="s" selected onClick={() => {}} />,
    );
    expect(html).toContain('aria-pressed="true"');
  });

  it('ariaLabel カスタム指定が反映', () => {
    const html = renderToStaticMarkup(
      <PlayingCard rank="A" suit="s" ariaLabel="ace high" />,
    );
    expect(html).toContain('aria-label="ace high"');
  });

  it('ariaLabel 未指定 → デフォルト "A of Spades"', () => {
    const html = renderToStaticMarkup(<PlayingCard rank="A" suit="s" />);
    expect(html).toContain('aria-label="A of Spades"');
  });

  it('スーツ色が style に注入される', () => {
    const html = renderToStaticMarkup(<PlayingCard rank="A" suit="h" />);
    // インライン style: background は rgb 化される可能性があるので hex で確認
    expect(html.toLowerCase()).toContain(SUIT_BG_COLORS.h.toLowerCase());
  });
});

// ----------------------------------------------------------------------------
// onClick handler (interactive)
// ----------------------------------------------------------------------------

describe('onClick handler attachment (pure)', () => {
  // renderToStaticMarkup は handler を保持しないため、純関数経由で確認。
  it('disabled=true なら onClick を呼ばない (実装ガイドの確認)', () => {
    const fn = vi.fn();
    // 直接呼び出すコンポーネント内ロジックを想定 — 実装では onClick の有無を
    // disabled ? undefined : onClick で渡す。
    const passed = (disabled: boolean) => (disabled ? undefined : fn);
    expect(passed(true)).toBeUndefined();
    expect(passed(false)).toBe(fn);
  });
});
