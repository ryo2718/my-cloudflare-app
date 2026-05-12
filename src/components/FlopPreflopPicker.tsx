// § 3: Preflop シナリオ選択 (1 つ)。元要件:
//   ○limp ○srp ○2bp ○3bp ○4bp ○5bp
//   存在しない組合せは disabled (グレー、クリック不可)。
//
// Q1 確定 (B 案):
//   - limp / 2bp は SB-BB ペアでのみ有効
//   - 5bp は UTG-BB / UTG-SB のみ有効
//   - その他は positions と variant 実在性で判定 (findFlopVariantFromUI)

import type { CSSProperties } from 'react';
import type { Position } from '../types/strategy';
import { findFlopVariantFromUI, type PreflopBucket } from '../data/flopVariants';
import { THEME } from '../styles/theme';

export interface FlopPreflopPickerProps {
  bucket: PreflopBucket | null;
  /** 現在選択中の 2 positions。length < 2 なら全 bucket disabled。 */
  positions: ReadonlyArray<Position>;
  onChange: (bucket: PreflopBucket | null) => void;
}

const BUCKETS: ReadonlyArray<{ id: PreflopBucket; label: string }> = [
  { id: 'limp', label: 'limp' },
  { id: 'srp', label: 'srp' },
  { id: '2bp', label: '2bp' },
  { id: '3bp', label: '3bp' },
  { id: '4bp', label: '4bp' },
  { id: '5bp', label: '5bp' },
];

export function FlopPreflopPicker({ bucket, positions, onChange }: FlopPreflopPickerProps) {
  const isEnabled = (b: PreflopBucket): boolean => {
    if (positions.length < 2) return false;
    return findFlopVariantFromUI(positions as [Position, Position], b) !== null;
  };

  const handleClick = (b: PreflopBucket) => {
    if (!isEnabled(b)) return;
    onChange(bucket === b ? null : b); // 同じ click で toggle off
  };

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>Preflop シナリオ (1 つ選択)</div>
      <div style={buttonsStyle}>
        {BUCKETS.map((b) => {
          const enabled = isEnabled(b.id);
          const selected = bucket === b.id;
          const style = selected
            ? selectedButtonStyle
            : !enabled
            ? disabledButtonStyle
            : buttonStyle;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => handleClick(b.id)}
              disabled={!enabled}
              style={style}
              title={!enabled ? 'この組合せのデータなし' : undefined}
            >
              {selected && <span style={checkStyle}>✓</span>}
              {b.label}
            </button>
          );
        })}
      </div>
      {positions.length < 2 && (
        <div style={hintStyle}>先に Position を 2 つ選択してください</div>
      )}
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
  fontSize: '0.9rem',
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
  background: THEME.bg,
  color: THEME.textFaint,
  cursor: 'not-allowed',
  opacity: 0.5,
};

const checkStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: 'inherit',
};

const hintStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: THEME.textMuted,
  fontStyle: 'italic',
};
