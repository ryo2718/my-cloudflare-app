// エクイティ計算のカードスロット (1 枚分)。
// カードがあれば PlayingCard を表示、無ければ空スロット ([+])。
// onClick 省略時は表示専用 (タップ不可)。カード選択は範囲ボタン側で行うため
// スロット自体は表示専用で使う。

import type { CSSProperties } from 'react';
import { PlayingCard } from '../PlayingCard';
import { THEME } from '../../styles/theme';
import type { Card } from '../../types/card';

export interface CardSlotProps {
  card: Card | null;
  /** 選択中 (カード選択パネルを開いている) スロットか。 */
  active?: boolean;
  /** 省略時は表示専用 (タップ不可)。 */
  onClick?: () => void;
}

export function CardSlot({ card, active = false, onClick }: CardSlotProps) {
  if (card) {
    return (
      <span style={active ? activeWrapStyle : undefined}>
        <PlayingCard rank={card.rank} suit={card.suit} size="lg" onClick={onClick} />
      </span>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={active ? { ...emptyStyle, ...emptyActiveStyle } : emptyStyle}
        aria-label="カードを選択"
      >
        +
      </button>
    );
  }
  return (
    <div style={emptyDisplayStyle} aria-hidden="true">
      +
    </div>
  );
}

const emptyStyle: CSSProperties = {
  width: 44,
  height: 62,
  borderRadius: 6,
  border: `2px dashed ${THEME.border}`,
  background: '#fff',
  color: THEME.textMuted,
  fontSize: 22,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const emptyDisplayStyle: CSSProperties = { ...emptyStyle, cursor: 'default' };

const emptyActiveStyle: CSSProperties = {
  borderColor: THEME.accent,
  borderStyle: 'solid',
};

const activeWrapStyle: CSSProperties = {
  outline: `2px solid ${THEME.accent}`,
  outlineOffset: 1,
  borderRadius: 8,
  display: 'inline-block',
};
