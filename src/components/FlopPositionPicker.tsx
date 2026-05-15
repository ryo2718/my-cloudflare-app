// § 2: Position 選択 — 最大 2 つまでトグル。
//   選択中を再 click → 解除 / 2 つ選択済みで未選択 click → 無反応 (グレーアウト)。

import type { CSSProperties } from 'react';
import type { Position } from '../types/strategy';
import { THEME } from '../styles/theme';

export interface FlopPositionPickerProps {
  positions: ReadonlyArray<Position>;
  onChange: (positions: Position[]) => void;
}

const ALL_POSITIONS: ReadonlyArray<Position> = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];

export function FlopPositionPicker({ positions, onChange }: FlopPositionPickerProps) {
  const isMaxed = positions.length >= 2;

  const handleClick = (pos: Position) => {
    if (positions.includes(pos)) {
      onChange(positions.filter((p) => p !== pos));
      return;
    }
    if (!isMaxed) {
      onChange([...positions, pos]);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>Position (最大 2 つ選択)</div>
      <div style={buttonsStyle}>
        {ALL_POSITIONS.map((pos) => {
          const selected = positions.includes(pos);
          const disabled = !selected && isMaxed;
          const style = selected
            ? selectedButtonStyle
            : disabled
              ? disabledButtonStyle
              : buttonStyle;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => handleClick(pos)}
              disabled={disabled}
              aria-pressed={selected}
              style={style}
            >
              {selected && <span style={checkStyle}>✓</span>}
              {pos}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.85rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: THEME.textSecondary,
  fontWeight: 700,
};

const buttonsStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
};

const buttonStyle: CSSProperties = {
  background: THEME.cardElevated,
  color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.375rem',
  padding: '0.5rem 0.85rem',
  fontSize: '0.92rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  minWidth: '54px',
  justifyContent: 'center',
};

const selectedButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: '#1a1a1a',
  color: '#ffffff',
  border: '1px solid #1a1a1a',
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
};

const checkStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: 'inherit',
};
