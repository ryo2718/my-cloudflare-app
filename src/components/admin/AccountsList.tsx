// /admin/accounts: アカウント一覧 + 検索 + 平文パスのトグル表示。

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  apiAdminListAccounts,
  type AccountAdmin,
} from '../../api/admin';
import { useAuth } from '../../hooks/useAuth';
import { AppHeader } from '../AppHeader';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; accounts: AccountAdmin[] };

export function AccountsList() {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [filter, setFilter] = useState('');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    apiAdminListAccounts(sid)
      .then((accounts) => {
        if (cancelled) return;
        setState({ kind: 'ok', accounts });
      })
      .catch((err) => {
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

  const filtered = useMemo(() => {
    if (state.kind !== 'ok') return [] as AccountAdmin[];
    if (!filter) return state.accounts;
    const q = filter.toLowerCase();
    return state.accounts.filter((a) => a.poker_name.toLowerCase().includes(q));
  }, [state, filter]);

  const togglePass = (id: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={pageStyle}>
      <AppHeader showBack adminMode />
      <main style={mainStyle}>
        <div style={topRowStyle}>
          <h1 style={titleStyle}>アカウント一覧</h1>
          <Link to="/admin" style={backToAdminStyle}>← 管理ダッシュボード</Link>
        </div>

        <input
          type="search"
          placeholder="ポーカーネームで検索"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={searchStyle}
        />

        {state.kind === 'loading' && <div style={infoStyle}>読み込み中…</div>}
        {state.kind === 'error' && (
          <div style={errorStyle}>取得失敗: {state.message}</div>
        )}
        {state.kind === 'ok' && (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>ポーカーネーム</th>
                  <th style={thStyle}>パスワード</th>
                  <th style={thStyle}>Admin</th>
                  <th style={thStyle}>作成</th>
                  <th style={thStyle}>最終ログイン</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td style={tdStyle}>{a.id}</td>
                    <td style={tdStyle}>{a.poker_name}</td>
                    <td style={tdStyle}>
                      {revealed.has(a.id) ? (
                        <code style={passShownStyle}>{a.private_pass}</code>
                      ) : (
                        <span style={passHiddenStyle}>•••••••</span>
                      )}
                      <button
                        type="button"
                        onClick={() => togglePass(a.id)}
                        style={revealBtnStyle}
                      >
                        {revealed.has(a.id) ? '隠す' : '表示'}
                      </button>
                    </td>
                    <td style={tdStyle}>{a.is_admin ? '✓' : ''}</td>
                    <td style={tdStyle}>{formatTime(a.created_at)}</td>
                    <td style={tdStyle}>{formatTime(a.last_login_at)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={emptyRowStyle}>該当アカウントなし</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function formatTime(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '—';
  // 日本標準表記 yyyy-MM-dd HH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: THEME.bg,
  display: 'flex',
  flexDirection: 'column',
};
const mainStyle: CSSProperties = {
  flex: 1,
  padding: '1.25rem 1rem',
  maxWidth: 960,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
};
const topRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  flexWrap: 'wrap',
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.15rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const backToAdminStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.accent,
  textDecoration: 'none',
};
const searchStyle: CSSProperties = {
  padding: '0.5rem 0.7rem',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.35rem',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
};
const infoStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.textMuted };
const errorStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.4rem 0.6rem',
};
const tableWrapStyle: CSSProperties = {
  overflowX: 'auto',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
};
const tableStyle: CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  minWidth: 600,
  fontSize: '0.85rem',
};
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.55rem 0.7rem',
  borderBottom: `1px solid ${THEME.border}`,
  background: '#f8f4ec',
  color: THEME.textSecondary,
  fontSize: '0.75rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};
const tdStyle: CSSProperties = {
  padding: '0.55rem 0.7rem',
  borderBottom: `1px solid ${THEME.border}`,
  verticalAlign: 'middle',
};
const passShownStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.85rem',
  color: THEME.textPrimary,
  background: '#fef3c7',
  padding: '1px 5px',
  borderRadius: '3px',
};
const passHiddenStyle: CSSProperties = {
  letterSpacing: '0.15em',
  color: THEME.textMuted,
};
const revealBtnStyle: CSSProperties = {
  marginLeft: '0.4rem',
  background: 'transparent',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.25rem',
  padding: '1px 6px',
  fontSize: '0.7rem',
  color: THEME.textSecondary,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const emptyRowStyle: CSSProperties = {
  padding: '1.5rem',
  textAlign: 'center',
  color: THEME.textMuted,
  fontSize: '0.85rem',
};
