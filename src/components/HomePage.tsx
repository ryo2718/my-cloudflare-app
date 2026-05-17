// ホーム画面: Strategy / Quiz の二大ボタン。認証後の最初の画面。

import { type CSSProperties } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from '../router/router';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

export function HomePage() {
  const auth = useAuth();
  const name = auth.account?.poker_name ?? '';

  return (
    <div style={pageStyle}>
      <AppHeader />
      <main style={mainStyle}>
        <h1 style={greetingStyle}>
          ようこそ、<span style={nameStyle}>{name}</span> さん
        </h1>

        <nav style={buttonRowStyle} aria-label="メインメニュー">
          <Link to="/strategy" style={bigButtonStyle}>
            <span style={bigButtonIconStyle}>📊</span>
            <span style={bigButtonTitleStyle}>Strategy</span>
            <span style={bigButtonSubStyle}>GTO 戦略ビューア</span>
          </Link>

          <Link to="/quiz" style={bigButtonStyle}>
            <span style={bigButtonIconStyle}>🎯</span>
            <span style={bigButtonTitleStyle}>Quiz</span>
            <span style={bigButtonSubStyle}>ポーカークイズ (実装中)</span>
          </Link>
        </nav>
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
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  padding: '1.5rem 1rem',
  maxWidth: 520,
  width: '100%',
  margin: '0 auto',
  gap: '1.5rem',
};

const greetingStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 500,
  color: THEME.textPrimary,
  margin: 0,
};

const nameStyle: CSSProperties = {
  color: THEME.accent,
  fontWeight: 700,
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const bigButtonStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.3rem',
  background: '#fff',
  border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.7rem',
  padding: '1.4rem 1rem',
  minHeight: 130,
  textDecoration: 'none',
  color: THEME.textPrimary,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  transition: 'background 0.1s, border-color 0.1s, transform 0.05s',
  cursor: 'pointer',
};

const bigButtonIconStyle: CSSProperties = {
  fontSize: '2.4rem',
  lineHeight: 1,
};

const bigButtonTitleStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: THEME.accent,
};

const bigButtonSubStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
};
