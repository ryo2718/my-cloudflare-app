// ホーム画面: 認証後に最初に表示される画面。
//
// レイアウト:
//   タイトル "PokerGTO Viewer"
//   3 ボタン (戦略 / トレーニング / アカウント情報) を縦に並べる。

import { type CSSProperties } from 'react';
import { Link } from '../router/router';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

export function HomePage() {
  return (
    <div style={pageStyle}>
      <AppHeader />
      <main style={mainStyle}>
        <h1 style={titleStyle}>PokerGTO Viewer</h1>

        <nav style={buttonColStyle} aria-label="メインメニュー">
          <Link to="/strategy" style={bigButtonStyle}>
            <span style={bigButtonIconStyle}>📊</span>
            <span style={bigButtonTitleStyle}>戦略</span>
            <span style={bigButtonSubStyle}>GTO 戦略ビューア</span>
          </Link>

          <Link to="/strategy-v2" style={bigButtonStyle}>
            <span style={bigButtonIconStyle}>🧭</span>
            <span style={bigButtonTitleStyle}>戦略 v2</span>
            <span style={bigButtonSubStyle}>プリフロップ レンジ (新)</span>
          </Link>

          <Link to="/quiz" style={bigButtonStyle}>
            <span style={bigButtonIconStyle}>🎯</span>
            <span style={bigButtonTitleStyle}>トレーニング</span>
            <span style={bigButtonSubStyle}>クイズ・練習問題</span>
          </Link>

          <Link to="/equity" style={bigButtonStyle}>
            <span style={bigButtonIconStyle} aria-hidden>
              <PieChartIcon />
            </span>
            <span style={bigButtonTitleStyle}>エクイティ計算</span>
            <span style={bigButtonSubStyle}>ハンドの勝率を計算</span>
          </Link>

          <Link to="/ranking" style={bigButtonStyle}>
            <span style={bigButtonIconStyle}>🏆</span>
            <span style={bigButtonTitleStyle}>ランキング</span>
            <span style={bigButtonSubStyle}>みんなの順位</span>
          </Link>

          <Link to="/account" style={bigButtonStyle}>
            <span style={bigButtonIconStyle}>👤</span>
            <span style={bigButtonTitleStyle}>アカウント情報</span>
            <span style={bigButtonSubStyle}>ポイント・成績</span>
          </Link>
        </nav>
      </main>
    </div>
  );
}

/** 円グラフ (パイチャート) アイコン。 */
function PieChartIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" role="img" aria-label="円グラフ">
      <circle cx="18" cy="18" r="16" fill="#E24B4A" />
      {/* 約 22% のスライス (エクイティのイメージ) を別色で */}
      <path d="M18 18 L18 2 A16 16 0 0 1 33.2 13 Z" fill="#3B6D11" />
      <circle cx="18" cy="18" r="16" fill="none" stroke="#5F5E5A" strokeWidth="1.5" />
    </svg>
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

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.4rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  letterSpacing: '0.02em',
  textAlign: 'center',
};

const buttonColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
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
  padding: '1.2rem 1rem',
  minHeight: 110,
  textDecoration: 'none',
  color: THEME.textPrimary,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  transition: 'background 0.1s, border-color 0.1s',
  cursor: 'pointer',
};

const bigButtonIconStyle: CSSProperties = {
  fontSize: '2.2rem',
  lineHeight: 1,
};

const bigButtonTitleStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: THEME.accent,
};

const bigButtonSubStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: THEME.textSecondary,
};
