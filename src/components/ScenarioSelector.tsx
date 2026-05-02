import type { CSSProperties } from 'react';
import {
  OPENER_POSITIONS,
  getValidResponders,
  type OpenerPosition,
} from '../data/scenarios';
import { THEME } from '../styles/theme';
import type { Position } from '../types/strategy';

interface Props {
  opener: OpenerPosition;
  responder: Position;
  onOpenerChange: (opener: OpenerPosition) => void;
  onResponderChange: (responder: Position) => void;
}

const labelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  fontSize: '1rem',
  color: THEME.textPrimary,
};

const captionStyle: CSSProperties = {
  fontSize: '0.75rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: THEME.textSecondary,
  fontWeight: 700,
};

const selectStyle: CSSProperties = {
  background: THEME.cardElevated,
  color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.6rem 1rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: '140px',
  appearance: 'auto',
};

export function ScenarioSelector({
  opener,
  responder,
  onOpenerChange,
  onResponderChange,
}: Props) {
  const responderOptions = getValidResponders(opener);

  return (
    <div
      style={{
        display: 'flex',
        gap: '1.5rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '1.1rem 1.25rem',
        background: THEME.card,
        border: `1px solid ${THEME.border}`,
        borderRadius: '0.5rem',
      }}
    >
      <label style={labelStyle}>
        <span style={captionStyle}>Opener</span>
        <select
          value={opener}
          onChange={(e) => onOpenerChange(e.target.value as OpenerPosition)}
          style={selectStyle}
        >
          {OPENER_POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <span style={{ color: THEME.textMuted, fontSize: '1rem', fontWeight: 700 }}>vs</span>

      <label style={labelStyle}>
        <span style={captionStyle}>Responder</span>
        <select
          value={responder}
          onChange={(e) => onResponderChange(e.target.value as Position)}
          style={selectStyle}
        >
          {responderOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
