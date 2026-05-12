// § 1 (FLOP 入力) の grid 部分。13 ランク × 4 スート = 52 セル。
// SUIT_COLOR で色付け、選択済みは disabled + 視覚的にグレーアウト。
//
// Phase R2 改修: 3 slot 表示 + footer (count + Reset) は親 (FlopBoardInput) 側に移動、
// 本 component は **pure grid** のみ。click → onSelect(card)。

import type { CSSProperties } from 'react';
import type { Card, Rank, Suit } from '../types/card';
import {
  RANKS,
  SUITS,
  SUIT_COLOR,
  SUIT_SYMBOL,
  containsCard,
} from '../types/card';
import { THEME } from '../styles/theme';

interface Props {
  selectedCards: ReadonlyArray<Card>;
  onSelect: (card: Card) => void;
}

export function FlopKeyboard({ selectedCards, onSelect }: Props) {
  return (
    <div style={gridStyle}>
      {RANKS.map((r) =>
        SUITS.map((s) => {
          const card: Card = { rank: r, suit: s };
          const selected = containsCard(selectedCards, card);
          return (
            <CardCell
              key={`${r}${s}`}
              rank={r}
              suit={s}
              selected={selected}
              onClick={() => onSelect(card)}
            />
          );
        }),
      )}
    </div>
  );
}

function CardCell({
  rank,
  suit,
  selected,
  onClick,
}: {
  rank: Rank;
  suit: Suit;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={selected}
      style={selected ? cellSelectedStyle : cellStyle}
      title={selected ? '選択済' : `${rank}${SUIT_SYMBOL[suit]}`}
    >
      <span style={cellRankStyle}>{rank}</span>
      <span style={{ ...cellSuitStyle, color: SUIT_COLOR[suit] }}>
        {SUIT_SYMBOL[suit]}
      </span>
    </button>
  );
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '4px',
};

const cellStyle: CSSProperties = {
  background: THEME.cardElevated,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  padding: '0.35rem 0.3rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.15rem',
  fontFamily: 'inherit',
  minHeight: '38px',
  userSelect: 'none',
};

const cellSelectedStyle: CSSProperties = {
  ...cellStyle,
  background: THEME.bg,
  opacity: 0.35,
  cursor: 'not-allowed',
  textDecoration: 'line-through',
};

const cellRankStyle: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};

const cellSuitStyle: CSSProperties = {
  fontSize: '1rem',
  lineHeight: 1,
};
