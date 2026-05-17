// 共通ヘッダー: poker_name 表示 + 戻る + ログアウト。
// 画面占有しすぎないコンパクト設計 (~32px 高さ)。

import { type CSSProperties } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from '../router/router';
import { navigate } from '../router/router-core';
import { THEME } from '../styles/theme';

export interface AppHeaderProps {
  /** "← ホームに戻る" ボタンを表示する画面で true。Home では false。 */
  showBack?: boolean;
  /** Admin 画面で true にすると配色をやや落とす (グレー寄せ)。 */
  adminMode?: boolean;
}

export function AppHeader({ showBack = false, adminMode = false }: AppHeaderProps) {
  const auth = useAuth();

  const handleLogout = async () => {
    await auth.logout();
    // logout 後はマウントツリーが LoginGate に切り替わる (status=unauthenticated)。
    // 念のため URL も / に戻す。
    navigate('/');
  };

  return (
    <header style={adminMode ? headerAdminStyle : headerStyle}>
      <div style={leftStyle}>
        {showBack && (
          <Link to="/" style={backLinkStyle}>
            ← ホーム
          </Link>
        )}
      </div>
      <div style={rightStyle}>
        {auth.account && (
          <>
            <span style={userNameStyle}>{auth.account.poker_name}</span>
            {auth.account.is_admin && (
              <Link to="/admin" style={adminLinkStyle}>
                管理画面
              </Link>
            )}
            <button type="button" onClick={handleLogout} style={logoutBtnStyle}>
              ログアウト
            </button>
          </>
        )}
      </div>
    </header>
  );
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.5rem 0.85rem',
  background: THEME.card,
  borderBottom: `1px solid ${THEME.border}`,
  fontSize: '0.82rem',
  minHeight: 36,
};

const headerAdminStyle: CSSProperties = {
  ...headerStyle,
  background: '#f0eee9',
  borderBottomColor: '#b8a888',
};

const leftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
};

const rightStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
};

const backLinkStyle: CSSProperties = {
  color: THEME.textSecondary,
  textDecoration: 'none',
  fontSize: '0.82rem',
  padding: '0.2rem 0.4rem',
};

const userNameStyle: CSSProperties = {
  color: THEME.textPrimary,
  fontWeight: 600,
  fontSize: '0.82rem',
};

const adminLinkStyle: CSSProperties = {
  color: THEME.accent,
  textDecoration: 'none',
  fontSize: '0.78rem',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  padding: '0.15rem 0.5rem',
};

const logoutBtnStyle: CSSProperties = {
  background: 'transparent',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  padding: '0.2rem 0.55rem',
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
