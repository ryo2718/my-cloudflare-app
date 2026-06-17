// Phase 2a: config 選択画面。7 gto config を大きなボタンで縦に並べる。

import { type CSSProperties } from 'react';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';
import { PREFLOP_V2_CONFIGS } from '../../data/preflopV2/configs';

export function ConfigPicker() {
  return (
    <div>
      <h1 style={titleStyle}>プリフロップ レンジ</h1>
      <p style={subtitleStyle}>スタック・レーキを選択</p>
      <nav style={colStyle} aria-label="コンフィグ選択">
        {PREFLOP_V2_CONFIGS.map((c) => (
          <Link key={c.id} to={`/strategy-v2/${c.id}`} style={buttonStyle}>
            {c.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.3rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  textAlign: 'center',
};

const subtitleStyle: CSSProperties = {
  margin: '0.3rem 0 1.2rem',
  fontSize: '0.85rem',
  color: THEME.textSecondary,
  textAlign: 'center',
};

const colStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.7rem',
};

const buttonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
  border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.7rem',
  padding: '1rem',
  minHeight: 56,
  fontSize: '1.05rem',
  fontWeight: 700,
  color: THEME.accent,
  textDecoration: 'none',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};
