import type { CSSProperties } from 'react';
import { THEME } from '../styles/theme';

export type TopTab = 'preflop' | 'flop';

interface Props {
  active: TopTab;
  onChange: (tab: TopTab) => void;
}

/**
 * PC 用の上部 underline タブ (Preflop / Flop)。
 *
 * Mobile の `components/mobile/TabSwitcher.tsx` のスタイル踏襲。Phase 5 で `App.tsx`
 * から `activeTab` state と一緒に配線する。Phase 2 ではスタブとして単独で動作する。
 */
export function TopTabs({ active, onChange }: Props) {
  return (
    <div style={containerStyle}>
      <TabButton label="Preflop" active={active === 'preflop'} onClick={() => onChange('preflop')} />
      <TabButton label="Flop" active={active === 'flop'} onClick={() => onChange('flop')} />
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? activeStyle : inactiveStyle}
    >
      {label}
    </button>
  );
}

const containerStyle: CSSProperties = {
  display: 'flex',
  gap: '4px',
  marginBottom: '0.75rem',
  borderBottom: `1px solid ${THEME.border}`,
};

const baseStyle: CSSProperties = {
  padding: '8px 16px',
  fontSize: '14px',
  textAlign: 'center',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  fontFamily: 'inherit',
};

const activeStyle: CSSProperties = {
  ...baseStyle,
  background: THEME.card,
  borderBottom: `2px solid ${THEME.accent}`,
  color: THEME.textPrimary,
  fontWeight: 500,
};

const inactiveStyle: CSSProperties = {
  ...baseStyle,
  color: THEME.textMuted,
};
