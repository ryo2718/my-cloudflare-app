import type { CSSProperties } from 'react';
import type { MobileTab } from '../../types/mobile';

interface Props {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}

export function TabSwitcher({ active, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '0.75rem',
        borderBottom: '1px solid #d6cfc1',
      }}
    >
      <button
        type="button"
        style={active === 'range' ? activeStyle : inactiveStyle}
        onClick={() => onChange('range')}
      >
        Hand Range
      </button>
      <button
        type="button"
        style={active === 'eval' ? activeStyle : inactiveStyle}
        onClick={() => onChange('eval')}
      >
        Hand Eval
      </button>
    </div>
  );
}

const baseStyle: CSSProperties = {
  flex: 1,
  padding: '8px',
  fontSize: '13px',
  textAlign: 'center',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  fontFamily: 'inherit',
};

const activeStyle: CSSProperties = {
  ...baseStyle,
  background: '#fefdf9',
  borderBottom: '2px solid #b45309',
  color: '#3d2f1f',
  fontWeight: 500,
};

const inactiveStyle: CSSProperties = {
  ...baseStyle,
  color: '#8c7d6a',
};
