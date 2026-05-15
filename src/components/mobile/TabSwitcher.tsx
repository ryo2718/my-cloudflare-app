import type { CSSProperties } from 'react';
import type { MobileTab } from '../../types/mobile';

interface Props {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}

interface TabDef {
  id: MobileTab;
  label: string;
}

const TABS: ReadonlyArray<TabDef> = [
  { id: 'range', label: 'Hand Range' },
  { id: 'eval', label: 'Hand Eval' },
  { id: 'flop', label: 'Flop' },
];

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
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          style={active === t.id ? activeStyle : inactiveStyle}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const baseStyle: CSSProperties = {
  flex: 1,
  padding: '8px 4px',
  fontSize: '13px',
  textAlign: 'center',
  cursor: 'pointer',
  background: 'transparent',
  // 透明 2px の bottom border で active との height 差をなくし、切替時の layout shift を防ぐ。
  border: 'none',
  borderBottom: '2px solid transparent',
  // Browser 既定の :focus outline (青リング) が active の orange underline と重なって
  // 「inactive にも下線」と見える誤認を防ぐ。
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.12s, color 0.12s',
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
