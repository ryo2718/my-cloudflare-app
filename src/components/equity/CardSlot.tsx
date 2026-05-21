// エクイティ計算のカードスロット (1 枚分)。
// カードがあれば PlayingCard を表示、無ければ空スロット (タップでカード選択)。

import type { CSSProperties } from 'react';
import { PlayingCard } from '../PlayingCard';
import { THEME } from '../../styles/theme';
import type { Card } from '../../types/card';

export interface CardSlotProps {
  card: Card | null;
  /** 選択中 (カード選択パネルを開いている) スロットか。 */
  active?: boolean;
  onClick: () => void;
}

export function CardSlot({ card, active = false, onClick }: CardSlotProps) {
  if (card) {
    return (
      <span style={active ? activeWrapStyle : undefined}>
        <PlayingCard rank={card.rank} suit={card.suit} size="lg" onClick={onClick} />
      </span>
    );
  }
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
