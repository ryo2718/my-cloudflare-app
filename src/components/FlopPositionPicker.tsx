// § 2: Position 選択 (2 つ)。元要件:
//   ○SB ○BB ○UTG ○HJ ○CO ○BTN
//   2 つ選択、3 つ目クリック で 最古を pop (FIFO)、選択中はダーク背景 + ✓

import type { CSSProperties } from 'react';
import type { Position } from '../types/strategy';
import { THEME } from '../styles/theme';

export interface FlopPositionPickerProps {
  positions: ReadonlyArray<Position>;
  onChange: (positions: Position[]) => void;
}

const ALL_POSITIONS: ReadonlyArray<Position> = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];

export function FlopPositionPicker({ positions, onChange }: FlopPositionPickerProps) {
  const handleClick = (pos: Position) => {
    if (positions.includes(pos)) {
      // 選択中を再 click → 解除
      onChange(positions.filter((p) => p !== pos));
      return;
    }
    if (positions.length < 2) {
      onChange([...positions, pos]);
      return;
    }
    // 既に 2 つ選択中で 3 つ目を click → 最古を pop して 新規を追加 (FIFO)
    onChange([positions[1], pos]);
  };

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>Position (2 つ選択)</div>
      <div style={buttonsStyle}>
        {ALL_POSITIONS.map((pos) => {
          const selected = positions.includes(pos);
          return (
            <button
              key={pos}
              type="button"
              onClick={() => handleClick(pos)}
              style={selected ? selectedButtonStyle : buttonStyle}
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

const checkStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: 'inherit',
};
