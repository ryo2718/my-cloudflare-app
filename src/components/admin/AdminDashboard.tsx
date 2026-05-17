// 管理ダッシュボード: /admin
// アカウント一覧 / Group Key 更新 への入口 + ホーム戻り。

import { type CSSProperties } from 'react';
import { AppHeader } from '../AppHeader';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';

export function AdminDashboard() {
  return (
    <div style={pageStyle}>
      <AppHeader showBack adminMode />
      <main style={mainStyle}>
        <h1 style={titleStyle}>管理ダッシュボード</h1>
        <p style={subtitleStyle}>運営者専用 (is_admin)</p>

        <nav style={navStyle} aria-label="管理メニュー">
          <Link to="/admin/accounts" style={menuItemStyle}>
            <span style={menuIconStyle}>👥</span>
            <div>
              <div style={menuTitleStyle}>アカウント一覧</div>
              <div style={menuDescStyle}>登録ユーザーとパスワード閲覧</div>
            </div>
          </Link>
          <Link to="/admin/group-key" style={menuItemStyle}>
            <span style={menuIconStyle}>🔑</span>
            <div>
              <div style={menuTitleStyle}>Group Key 更新</div>
              <div style={menuDescStyle}>月次のグループキー切替と履歴</div>
            </div>
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
  padding: '1.5rem 1rem',
  maxWidth: 560,
  width: '100%',
  margin: '0 auto',
  gap: '1rem',
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const subtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.78rem',
  color: THEME.textMuted,
};
const navStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginTop: '0.5rem',
};
const menuItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.85rem',
  padding: '0.95rem 1.1rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.55rem',
  textDecoration: 'none',
  color: THEME.textPrimary,
};
const menuIconStyle: CSSProperties = {
  fontSize: '1.6rem',
  lineHeight: 1,
};
const menuTitleStyle: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: THEME.accent,
};
const menuDescStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: THEME.textMuted,
  marginTop: 2,
};
