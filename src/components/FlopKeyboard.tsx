// § 1 (FLOP 入力) の grid 部分 — 4 行 (♠ ♥ ♦ ♣) × 13 列 (A-2)。
//
// Fix 1: 横 1 列に 13 ボタン収まるコンパクトレイアウト。
// 各ボタンは ~24-30px 幅 / ~30px 高 / 12px font、スマホ 320px 幅でも収まる。
//
// Iteration: 外 SUITS / 内 RANKS で、各 row が単一スートになるよう順序固定。

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
      {SUITS.map((s) =>
        RANKS.map((r) => {
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

// ----------------------------------------------------------------------------
// Styles (compact: 13 cols × 4 rows)
// ----------------------------------------------------------------------------

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(13, 1fr)',
  gap: '3px',
  width: '100%',
};

const cellStyle: CSSProperties = {
  background: THEME.cardElevated,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.25rem',
  padding: '2px 0',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1px',
  fontFamily: 'inherit',
  minHeight: '30px',
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
  fontSize: '12px',
  fontWeight: 700,
  color: THEME.textPrimary,
  lineHeight: 1,
};

const cellSuitStyle: CSSProperties = {
  fontSize: '12px',
  lineHeight: 1,
};
