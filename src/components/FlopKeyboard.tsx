// 52 セルのカード入力グリッド (13 ランク × 4 スート)。
// 各セルは specific Card (rank+suit) を表現、SUIT_COLOR で色付け。
// 選択済みカードは disabled + 視覚的にグレーアウト + 取り消し線。
// 親 (FlopBoardInput) は 3 枚揃った時点で canonicalize を kick する責務。

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
  onReset: () => void;
}

export function FlopKeyboard({ selectedCards, onSelect, onReset }: Props) {
  return (
    <div style={containerStyle}>
      <div style={gridStyle}>
        {RANKS.map((r) => (
          <RankRow
            key={r}
            rank={r}
            selectedCards={selectedCards}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div style={footerStyle}>
        <span style={countStyle}>
          {selectedCards.length} / 3 cards selected
        </span>
        <button
          type="button"
          onClick={onReset}
          disabled={selectedCards.length === 0}
          style={selectedCards.length === 0 ? resetDisabledStyle : resetStyle}
        >
          ↻ Reset
        </button>
      </div>
    </div>
  );
}

function RankRow({
  rank,
  selectedCards,
  onSelect,
}: {
  rank: Rank;
  selectedCards: ReadonlyArray<Card>;
  onSelect: (card: Card) => void;
}) {
  return (
    <>
      {SUITS.map((s) => {
        const card: Card = { rank, suit: s };
        const selected = containsCard(selectedCards, card);
        return (
          <CardCell
            key={`${rank}${s}`}
            rank={rank}
            suit={s}
            selected={selected}
            onClick={() => onSelect(card)}
          />
        );
      })}
    </>
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

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.75rem',
  maxWidth: '280px',
};

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

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '0.6rem',
  gap: '0.5rem',
};

const countStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: THEME.textMuted,
};

const resetStyle: CSSProperties = {
  background: 'transparent',
  color: THEME.accent,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  padding: '0.3rem 0.7rem',
  fontSize: '0.75rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const resetDisabledStyle: CSSProperties = {
  ...resetStyle,
  color: THEME.textFaint,
  cursor: 'not-allowed',
};
