// PlayingCard 用の純関数・定数を集約 (react-refresh/only-export-components 回避)。
// テストはこのファイル経由で純関数・定数を直接 import できる。

import type { CSSProperties } from 'react';
import type { Rank, Suit } from '../types/card';

/** スーツ → 背景色 (薄め、白文字とコントラスト確保)。 */
export const SUIT_BG_COLORS: Record<Suit, string> = {
  s: '#5F5E5A', // Spade — グレー寄り黒
  h: '#E24B4A', // Heart — 明るい赤
  d: '#378ADD', // Diamond — 中間青
  c: '#639922', // Club — 中間緑
};

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'board';

/** サイズ定義 (md=26×32 が基準)。board=38×57 は縦長 2:3 (エクイティのボード用)。 */
export const CARD_SIZES: Record<CardSize, { width: number; height: number; fontSize: number }> = {
  xs: { width: 18, height: 22, fontSize: 11 },
  sm: { width: 22, height: 28, fontSize: 13 },
  md: { width: 26, height: 32, fontSize: 16 },
  lg: { width: 36, height: 48, fontSize: 22 },
  board: { width: 38, height: 57, fontSize: 18 },
};

export const SELECTED_OUTLINE_COLOR = '#FBBF24'; // amber-400
export const SELECTED_OUTLINE_WIDTH = 2;

const SUIT_NAME: Record<Suit, string> = {
  s: 'Spades',
  h: 'Hearts',
  d: 'Diamonds',
  c: 'Clubs',
};

export function defaultPlayingCardAriaLabel(rank: Rank, suit: Suit): string {
  return `${rank} of ${SUIT_NAME[suit]}`;
}

/**
 * Props からカード要素の CSSProperties を導出。click ハンドラ等は含まない。
 * テストから直接呼べる pure 関数として export。
 */
export function getPlayingCardStyle(props: {
  suit: Suit;
  size?: CardSize;
  disabled?: boolean;
  selected?: boolean;
  clickable?: boolean;
}): CSSProperties {
  const size = props.size ?? 'md';
  const dims = CARD_SIZES[size];
  const base: CSSProperties = {
    width: dims.width,
    height: dims.height,
    fontSize: dims.fontSize,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: SUIT_BG_COLORS[props.suit],
    color: '#ffffff',
    fontWeight: 500,
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    borderRadius: 4,
    textAlign: 'center',
    lineHeight: 1,
    boxSizing: 'border-box',
    border: 'none',
    padding: 0,
    userSelect: 'none',
  };
  if (props.clickable && !props.disabled) {
    base.cursor = 'pointer';
  }
  if (props.disabled) {
    base.opacity = 0.4;
    base.cursor = 'not-allowed';
  }
  if (props.selected) {
    base.outline = `${SELECTED_OUTLINE_WIDTH}px solid ${SELECTED_OUTLINE_COLOR}`;
    base.outlineOffset = -SELECTED_OUTLINE_WIDTH;
  }
  return base;
}
