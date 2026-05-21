// コンボ詳細 (4×4 スートマトリクス)。展開中ハンドのスート組み合わせを表示し、
// 各セルのタップで個別コンボを選択/解除する。
//   - 行 = 1枚目 (hi) のスート、列 = 2枚目 (lo) のスート
//   - 有効セル (pair 6 / suited 4 / offsuit 12) のみボタン、無効セルは空白
//   - 選択中は黄色

import type { CSSProperties } from 'react';
import { SUITS, SUIT_SYMBOL, SUIT_COLOR, type Card } from '../../types/card';
import { THEME } from '../../styles/theme';
import { comboAtSuits, comboKeyOf, type MatrixHand } from '../../utils/combos';

const CELL_FULL = '#fcd34d';
const CELL_PARTIAL = '#86efac';

export interface ComboDetailProps {
  hand: MatrixHand;
  /** コンボ key → weight (0..1)。weight 1=黄 / 0<w<1=緑 / 無し=グレー。 */
  selected: ReadonlyMap<string, number>;
  onToggle: (key: string) => void;
}

export function ComboDetail({ hand, selected, onToggle }: ComboDetailProps) {
  return (
    <div style={wrapStyle}>
      <span style={titleStyle}>{hand.label}</span>
      <div style={gridStyle}>
        {SUITS.map((_, row) =>
          SUITS.map((__, col) => {
            const combo = comboAtSuits(hand, row, col);
            if (!combo) return <div key={`${row}-${col}`} style={blankStyle} />;
            const key = comboKeyOf(combo[0], combo[1]);
            const w = selected.get(key) ?? 0;
            const bg = w >= 1 ? CELL_FULL : w > 0 ? CELL_PARTIAL : THEME.cellEmpty;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                onClick={() => onToggle(key)}
                aria-pressed={w > 0}
                style={{ ...cellStyle, background: bg }}
              >
                <CardLabel card={combo[0]} />
                <CardLabel card={combo[1]} />
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function CardLabel({ card }: { card: Card }) {
  return (
    <span style={{ color: SUIT_COLOR[card.suit] }}>
      {card.rank}
      {SUIT_SYMBOL[card.suit]}
    </span>
  );
}

const wrapStyle: CSSProperties = {
  marginTop: '0.6rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};
const titleStyle: CSSProperties = { fontSize: '0.85rem', fontWeight: 700, color: THEME.textPrimary };
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '0.3rem',
  maxWidth: 320,
};
const cellStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  height: 34,
  border: `1px solid ${THEME.border}`,
  borderRadius: 4,
  fontSize: '0.8rem',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  padding: 0,
};
const blankStyle: CSSProperties = { height: 34 };
