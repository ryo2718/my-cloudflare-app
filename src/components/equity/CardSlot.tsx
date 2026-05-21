// エクイティ計算のカードスロット (1 枚分)。
// カードがあれば PlayingCard を表示、無ければ空スロット ([+])。
// onClick 省略時は表示専用 (タップ不可)。size 指定時はそのサイズで表示 (空スロットも同寸)。
// 未指定は従来 (filled lg / empty 44×62)。

import type { CSSProperties } from 'react';
import { PlayingCard } from '../PlayingCard';
import { CARD_SIZES, type CardSize } from '../PlayingCard.helpers';
import { THEME } from '../../styles/theme';
import type { Card } from '../../types/card';

export interface CardSlotProps {
  card: Card | null;
  /** 選択中 (カード選択パネルを開いている) スロットか。 */
  active?: boolean;
  /** 省略時は表示専用 (タップ不可)。 */
  onClick?: () => void;
  /** カードサイズ。省略時は filled=lg / empty=44×62。 */
  size?: CardSize;
}

export function CardSlot({ card, active = false, onClick, size }: CardSlotProps) {
  if (card) {
    return (
      <span style={active ? activeWrapStyle : undefined}>
        <PlayingCard rank={card.rank} suit={card.suit} size={size ?? 'lg'} onClick={onClick} />
      </span>
    );
  }
  const dims = size ? CARD_SIZES[size] : { width: 44, height: 62, fontSize: 22 };
  const base: CSSProperties = {
    ...emptyBaseStyle,
    width: dims.width,
    height: dims.height,
    fontSize: dims.fontSize,
  };
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={active ? { ...base, ...emptyActiveStyle } : base}
        aria-label="カードを選択"
      >
        +
      </button>
    );
  }
  return (
    <div style={{ ...base, cursor: 'default' }} aria-hidden="true">
      +
    </div>
  );
}

const emptyBaseStyle: CSSProperties = {
  borderRadius: 6,
  border: `2px dashed ${THEME.border}`,
  background: '#fff',
  color: THEME.textMuted,
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
