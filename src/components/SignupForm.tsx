// 新規アカウント作成フォーム。LoginGate の Signup タブから呼ばれる。

import { useState, type CSSProperties } from 'react';
import { AuthApiError } from '../api/auth';
import { useAuth } from '../hooks/useAuth';
import { THEME } from '../styles/theme';

export function SignupForm() {
  const auth = useAuth();
  const [pokerName, setPokerName] = useState('');
  const [privatePass, setPrivatePass] = useState('');
  const [groupKey, setGroupKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await auth.signup({ pokerName, privatePass, groupKey });
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === 'invalid_group_key') setError('グループキーが違います');
        else if (err.code === 'name_taken') setError('そのポーカーネームは既に使われています');
        else if (err.code === 'invalid_payload') setError('入力値が不正です');
        else setError(`エラー: ${err.code}`);
      } else {
        setError(err instanceof Error ? err.message : '不明なエラー');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={formStyle}>
      <label style={labelStyle}>
        <span style={labelTextStyle}>ポーカーネーム</span>
        <input
          type="text"
          value={pokerName}
          onChange={(e) => setPokerName(e.target.value)}
          required
          maxLength={32}
          autoComplete="username"
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        <span style={labelTextStyle}>個人パスワード</span>
        <input
          type="password"
          value={privatePass}
          onChange={(e) => setPrivatePass(e.target.value)}
          required
          maxLength={128}
          autoComplete="new-password"
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        <span style={labelTextStyle}>グループキー (月次更新)</span>
        <input
          type="text"
          value={groupKey}
          onChange={(e) => setGroupKey(e.target.value)}
          required
          placeholder="Group Key を入力"
          style={inputStyle}
        />
      </label>
      {error && <div style={errorStyle}>{error}</div>}
      <button type="submit" disabled={submitting} style={submitStyle}>
        {submitting ? '作成中…' : 'アカウント作成'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Styles (LoginGate と揃える)
// ---------------------------------------------------------------------------

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
};
const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem' };
const labelTextStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  fontWeight: 600,
};
const inputStyle: CSSProperties = {
  padding: '0.45rem 0.6rem',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.35rem',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
  background: '#fff',
  color: THEME.textPrimary,
};
const errorStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.4rem 0.6rem',
};
const submitStyle: CSSProperties = {
  marginTop: '0.3rem',
  padding: '0.55rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.35rem',
  fontSize: '0.92rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
