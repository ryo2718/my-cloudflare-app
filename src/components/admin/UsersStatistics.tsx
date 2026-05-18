// /admin/users-statistics: 全ユーザー × レベル別の min/max/avg 正答率ダッシュボード。
// admin 専用。サーバー側で is_admin チェック (403)、クライアント側はリンクを admin 表示のみ。

import { useEffect, useState, type CSSProperties } from 'react';
import { apiAdminUsersStatistics, type UserStats } from '../../api/admin';
import { useAuth } from '../../hooks/useAuth';
import { AppHeader } from '../AppHeader';
import { THEME } from '../../styles/theme';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; users: UserStats[] };

const LEVELS = [
  { key: 'preflop_beginner', label: '初級' },
  { key: 'preflop_intermediate', label: '中級' },
] as const;

export function UsersStatistics() {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    apiAdminUsersStatistics(sid)
      .then((users) => {
        if (!cancelled) setState({ kind: 'ok', users });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [auth.sessionId]);

  return (
    <div style={pageStyle}>
      <AppHeader showBack adminMode />
      <main style={mainStyle}>
        <h1 style={titleStyle}>ユーザー統計</h1>
        <p style={subStyle}>全ユーザー (admin 除く) × レベル別の正答率</p>

        {state.kind === 'loading' && <div style={infoStyle}>読み込み中…</div>}
        {state.kind === 'error' && (
          <div style={errorStyle}>取得失敗: {state.message}</div>
        )}
        {state.kind === 'ok' && state.users.length === 0 && (
          <div style={infoStyle}>ユーザーがいません。</div>
        )}
        {state.kind === 'ok' &&
          state.users.map((u) => <UserStatCard key={u.account_id} user={u} />)}
      </main>
    </div>
  );
}

function UserStatCard({ user }: { user: UserStats }) {
  return (
    <section style={userCardStyle} aria-label={`${user.poker_name} 統計`}>
      <header style={userHeaderStyle}>
        <span style={userNameStyle}>{user.poker_name}</span>
        <span style={userPtStyle}>累計 {user.total_points}pt</span>
      </header>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}></th>
            <th style={thStyle}>最小</th>
            <th style={thStyle}>最高</th>
            <th style={thStyle}>平均</th>
            <th style={thStyle}>挑戦</th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map(({ key, label }) => {
            const lv = user.levels[key];
            return (
              <tr key={key}>
                <td style={tdLabelStyle}>{label}</td>
                {lv ? (
                  <>
                    <td style={tdStyle}>{lv.min_correct_rate.toFixed(1)}%</td>
                    <td style={tdStyle}>{lv.max_correct_rate.toFixed(1)}%</td>
                    <td style={tdStyle}>{lv.avg_correct_rate.toFixed(1)}%</td>
                    <td style={tdStyle}>{lv.measured_attempts}</td>
                  </>
                ) : (
                  <td style={emptyTdStyle} colSpan={4}>
                    未挑戦
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  padding: '1.25rem 1rem',
  maxWidth: 640,
  width: '100%',
  margin: '0 auto',
  gap: '0.8rem',
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.2rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const subStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.78rem',
  color: THEME.textMuted,
};
const infoStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.textMuted,
};
const errorStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.5rem 0.7rem',
};
const userCardStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.8rem 0.95rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
const userHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
};
const userNameStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const userPtStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: THEME.accent,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
};
const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
};
const thStyle: CSSProperties = {
  fontWeight: 600,
  color: THEME.textSecondary,
  textAlign: 'right',
  padding: '0.3rem 0.4rem',
  borderBottom: `1px solid ${THEME.border}`,
};
const tdLabelStyle: CSSProperties = {
  padding: '0.35rem 0.4rem',
  color: THEME.textPrimary,
  borderBottom: `1px dashed ${THEME.border}`,
  fontWeight: 600,
};
const tdStyle: CSSProperties = {
  padding: '0.35rem 0.4rem',
  textAlign: 'right',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  color: THEME.textPrimary,
  borderBottom: `1px dashed ${THEME.border}`,
};
const emptyTdStyle: CSSProperties = {
  ...tdStyle,
  color: THEME.textMuted,
};
