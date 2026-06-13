// /admin/accounts: アカウント一覧 + 検索 + 平文パスのトグル表示。

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  apiAdminListAccounts,
  apiAdminAccountGrant,
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

  const [busy, setBusy] = useState<Set<number>>(new Set());
  const setBusyId = (id: number, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // grant 後にローカル state の該当行を更新 (再 fetch せず即反映)。
  const patchAccount = (id: number, partial: Partial<AccountAdmin>) =>
    setState((prev) =>
      prev.kind === 'ok'
        ? { kind: 'ok', accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...partial } : a)) }
        : prev,
    );

  const toggleTester = async (a: AccountAdmin) => {
    if (!auth.sessionId || busy.has(a.id)) return;
    setBusyId(a.id, true);
    try {
      const res = await apiAdminAccountGrant(auth.sessionId, { id: a.id, type: 'tester', value: !a.tester });
      patchAccount(a.id, { tester: res.account.tester });
    } catch {
      /* silent (画面はそのまま) */
    } finally {
      setBusyId(a.id, false);
    }
  };

  const applyVip = async (id: number, days: number | null) => {
    if (!auth.sessionId || busy.has(id)) return;
    setBusyId(id, true);
    try {
      const res = await apiAdminAccountGrant(auth.sessionId, { id, type: 'vip', days });
      patchAccount(id, { vip_until: res.account.vip_until });
    } catch {
      /* silent */
    } finally {
      setBusyId(id, false);
    }
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
                  <th style={thStyle}>テスター</th>
                  <th style={thStyle}>VIP</th>
                  <th style={thStyle}>合計pt</th>
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
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => toggleTester(a)}
                        disabled={busy.has(a.id)}
                        style={a.tester ? testerOnBtnStyle : testerOffBtnStyle}
                      >
                        {a.tester ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <VipControl
                        vipUntil={a.vip_until}
                        busy={busy.has(a.id)}
                        onApply={(days) => applyVip(a.id, days)}
                      />
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'ui-monospace, SFMono-Regular, monospace', textAlign: 'right' }}>
                      {a.total_points}
                    </td>
                    <td style={tdStyle}>{formatTime(a.created_at)}</td>
                    <td style={tdStyle}>{formatTime(a.last_login_at)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={emptyRowStyle}>該当アカウントなし</td>
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

/** VIP 状態 + 付与/解除コントロール (30/60/90/カスタム/解除)。 */
function VipControl({
  vipUntil,
  busy,
  onApply,
}: {
  vipUntil: number | null;
  busy: boolean;
  onApply: (days: number | null) => void;
}) {
  const [choice, setChoice] = useState<string>('30');
  const [custom, setCustom] = useState<string>('');

  const apply = () => {
    if (choice === 'off') {
      onApply(null);
      return;
    }
    if (choice === 'custom') {
      const n = Number(custom);
      if (!Number.isInteger(n) || n < 1 || n > 365) return; // 不正値は無視
      onApply(n);
      return;
    }
    onApply(Number(choice));
  };

  return (
    <div style={vipWrapStyle}>
      <span style={vipStatusStyle}>{vipStatusLabel(vipUntil)}</span>
      <div style={vipControlRowStyle}>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} style={vipSelectStyle} disabled={busy}>
          <option value="30">30日</option>
          <option value="60">60日</option>
          <option value="90">90日</option>
          <option value="custom">カスタム</option>
          <option value="off">解除</option>
        </select>
        {choice === 'custom' && (
          <input
            type="number"
            min={1}
            max={365}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="日数"
            style={vipCustomStyle}
            disabled={busy}
          />
        )}
        <button type="button" onClick={apply} disabled={busy} style={vipApplyBtnStyle}>
          適用
        </button>
      </div>
    </div>
  );
}

/** vip_until → 表示ラベル ("—" / "残りN日 (yyyy-MM-dd)" / "期限切れ")。 */
function vipStatusLabel(vipUntil: number | null): string {
  if (vipUntil === null || vipUntil === undefined) return '—';
  const now = Date.now();
  if (vipUntil <= now) return '期限切れ';
  const days = Math.ceil((vipUntil - now) / (24 * 60 * 60 * 1000));
  const d = new Date(vipUntil);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `残り${days}日 (${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())})`;
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
const testerOnBtnStyle: CSSProperties = {
  background: '#3B6D11',
  color: '#fff',
  border: 'none',
  borderRadius: '0.25rem',
  padding: '2px 10px',
  fontSize: '0.72rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const testerOffBtnStyle: CSSProperties = {
  ...testerOnBtnStyle,
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
};
const vipWrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const vipStatusStyle: CSSProperties = { fontSize: '0.72rem', color: THEME.textSecondary, whiteSpace: 'nowrap' };
const vipControlRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.25rem' };
const vipSelectStyle: CSSProperties = {
  fontSize: '0.72rem',
  padding: '1px 2px',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.25rem',
  fontFamily: 'inherit',
};
const vipCustomStyle: CSSProperties = {
  width: '3.2rem',
  fontSize: '0.72rem',
  padding: '1px 4px',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.25rem',
  fontFamily: 'inherit',
};
const vipApplyBtnStyle: CSSProperties = {
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.25rem',
  padding: '2px 8px',
  fontSize: '0.72rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
