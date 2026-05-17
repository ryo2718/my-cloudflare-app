// /admin/group-key: 現在の group_key + 履歴 + 新 key 発行フォーム。

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  apiAdminListGroupKeys,
  apiAdminRotateGroupKey,
  type GroupKey,
} from '../../api/admin';
import { AuthApiError } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { AppHeader } from '../AppHeader';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';

export function GroupKeyForm() {
  const auth = useAuth();
  const [keys, setKeys] = useState<GroupKey[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!auth.sessionId) return;
    setLoadError(null);
    try {
      const list = await apiAdminListGroupKeys(auth.sessionId);
      setKeys(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [auth.sessionId]);

  useEffect(() => {
    // 外部 (D1) からの同期。eslint set-state-in-effect は既存パターン同様明示的に許容。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.sessionId) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await apiAdminRotateGroupKey(auth.sessionId, newKey.trim());
      setNewKey('');
      await refresh();
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === 'invalid_payload') setSubmitError('入力値が不正です');
        else if (err.code === 'forbidden') setSubmitError('権限がありません');
        else setSubmitError(`エラー: ${err.code}`);
      } else {
        setSubmitError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const active = keys?.find((k) => k.active_until === null) ?? null;
  const history = (keys ?? []).filter((k) => k.active_until !== null);

  return (
    <div style={pageStyle}>
      <AppHeader showBack adminMode />
      <main style={mainStyle}>
        <div style={topRowStyle}>
          <h1 style={titleStyle}>Group Key 更新</h1>
          <Link to="/admin" style={backToAdminStyle}>← 管理ダッシュボード</Link>
        </div>

        {loadError && <div style={errorStyle}>履歴取得失敗: {loadError}</div>}

        {/* 現在の有効 key */}
        <section style={sectionStyle}>
          <div style={sectionLabelStyle}>現在有効な Group Key</div>
          {active ? (
            <div style={activeKeyStyle}>
              <code style={keyCodeStyle}>{active.key_value}</code>
              <span style={activeFromStyle}>
                有効化: {formatTime(active.active_from)}
              </span>
            </div>
          ) : (
            <div style={noActiveStyle}>現在有効なキーがありません</div>
          )}
        </section>

        {/* 新 key 発行 */}
        <section style={sectionStyle}>
          <div style={sectionLabelStyle}>新しい Group Key を発行</div>
          <form onSubmit={onSubmit} style={formStyle}>
            <input
              type="text"
              placeholder="例: 4915"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              required
              maxLength={64}
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={submitting || newKey.trim().length === 0}
              style={submitting ? submitDisabledStyle : submitStyle}
            >
              {submitting ? '発行中…' : '発行 (旧 key 失効)'}
            </button>
          </form>
          {submitError && <div style={errorStyle}>{submitError}</div>}
        </section>

        {/* 履歴 */}
        <section style={sectionStyle}>
          <div style={sectionLabelStyle}>過去の Group Key</div>
          {history.length === 0 ? (
            <div style={infoStyle}>履歴なし</div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Key</th>
                    <th style={thStyle}>有効開始</th>
                    <th style={thStyle}>失効</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((k) => (
                    <tr key={k.id}>
                      <td style={tdStyle}>
                        <code>{k.key_value}</code>
                      </td>
                      <td style={tdStyle}>{formatTime(k.active_from)}</td>
                      <td style={tdStyle}>{formatTime(k.active_until)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function formatTime(ms: number | null): string {
  if (ms === null) return '—';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '—';
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
  maxWidth: 720,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};
const topRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
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

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.85rem 1rem',
};
const sectionLabelStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: THEME.textSecondary,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
const activeKeyStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.85rem',
  flexWrap: 'wrap',
};
const keyCodeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '1.25rem',
  background: '#FAEEDA',
  color: '#633806',
  padding: '0.25rem 0.6rem',
  borderRadius: '0.3rem',
  fontWeight: 700,
};
const activeFromStyle: CSSProperties = { fontSize: '0.78rem', color: THEME.textMuted };
const noActiveStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.errorText };

const formStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
};
const inputStyle: CSSProperties = {
  flex: '1 1 200px',
  padding: '0.45rem 0.6rem',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
};
const submitStyle: CSSProperties = {
  padding: '0.45rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.3rem',
  fontSize: '0.88rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const submitDisabledStyle: CSSProperties = {
  ...submitStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const errorStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.4rem 0.6rem',
};
const infoStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.textMuted };

const tableWrapStyle: CSSProperties = {
  overflowX: 'auto',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.35rem',
};
const tableStyle: CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  fontSize: '0.85rem',
  minWidth: 400,
};
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.45rem 0.7rem',
  borderBottom: `1px solid ${THEME.border}`,
  background: '#f8f4ec',
  fontSize: '0.72rem',
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};
const tdStyle: CSSProperties = {
  padding: '0.5rem 0.7rem',
  borderBottom: `1px solid ${THEME.border}`,
};
