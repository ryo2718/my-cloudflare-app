// Quiz 仮実装 (placeholder)。

import { type CSSProperties } from 'react';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

export function QuizPage() {
  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <div style={cardStyle}>
          <div style={iconStyle}>🎯</div>
          <h1 style={titleStyle}>Quiz</h1>
          <p style={subtitleStyle}>ポーカークイズは実装中です。</p>
          <p style={detailStyle}>Phase F 以降で本格実装予定。今後乞うご期待。</p>
        </div>
      </main>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: THEME.bg,
  display: 'flex',
  flexDirection: 'column',
};
const mainStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem 1rem',
};
const cardStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.7rem',
  padding: '2rem 1.4rem',
  maxWidth: 380,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
};
const iconStyle: CSSProperties = { fontSize: '3rem', lineHeight: 1 };
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.4rem',
  color: THEME.accent,
  fontWeight: 700,
};
const subtitleStyle: CSSProperties = { margin: 0, fontSize: '0.95rem', color: THEME.textPrimary };
const detailStyle: CSSProperties = { margin: 0, fontSize: '0.78rem', color: THEME.textMuted };
