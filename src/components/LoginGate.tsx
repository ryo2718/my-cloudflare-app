// 未認証時に App をラップして覆うログイン/サインアップゲート。
//
// 3 タブ構成:
//   - saved   ... 保存済みアカウント (件数 >= 1 ならデフォルト)
//   - login   ... 通常のログインフォーム
//   - signup  ... 新規アカウント作成
//
// 保存済みアカウントが 0 件になると自動で 'login' に切替。
// 認証成功時は AuthContext 経由でアンマウントされる。

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AuthApiError } from '../api/auth';
import { getSavedAccounts, type SavedAccount } from '../data/savedAccounts';
import { useAuth } from '../hooks/useAuth';
import { SavedAccountsTab } from './SavedAccountsTab';
import { SignupForm } from './SignupForm';
import { THEME } from '../styles/theme';

type Tab = 'saved' | 'login' | 'signup';

interface Props {
  children: ReactNode;
}

export function LoginGate({ children }: Props) {
  const auth = useAuth();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() =>
    getSavedAccounts(),
  );
  const [tab, setTab] = useState<Tab>(() =>
    savedAccounts.length >= 1 ? 'saved' : 'login',
  );

  const refreshSaved = () => setSavedAccounts(getSavedAccounts());

  // saved 件数が 0 になったら自動で login に切替 (保存済みタブが空表示にならないように)
  useEffect(() => {
    if (savedAccounts.length === 0 && tab === 'saved') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab('login');
    }
  }, [savedAccounts.length, tab]);

  if (auth.status === 'loading') {
    return (
      <div style={fullScreenStyle}>
        <div style={loadingStyle}>読み込み中…</div>
      </div>
    );
  }

  if (auth.status === 'authenticated') {
    return <>{children}</>;
  }

  const hasSaved = savedAccounts.length >= 1;

  return (
    <div style={fullScreenStyle}>
      <div style={cardStyle}>
        <header style={cardHeaderStyle}>
          <h1 style={titleStyle}>PokerGTO Viewer</h1>
        </header>

        {auth.signedOutReason === 'kicked' && (
          <div style={kickedNoticeStyle} role="status">
            他の端末でログインされました。再度ログインしてください。
          </div>
        )}

        <div style={tabRowStyle} role="tablist">
          {hasSaved && (
            <TabButton active={tab === 'saved'} onClick={() => setTab('saved')}>
              保存済み
            </TabButton>
          )}
          <TabButton active={tab === 'login'} onClick={() => setTab('login')}>
            ログイン
          </TabButton>
          <TabButton active={tab === 'signup'} onClick={() => setTab('signup')}>
            新規アカウント
          </TabButton>
        </div>

        <div style={paneStyle}>
          {tab === 'saved' && (
            <SavedAccountsTab
              accounts={savedAccounts}
              onListChange={refreshSaved}
              onSwitchToLoginTab={() => setTab('login')}
            />
          )}
          {tab === 'login' && <LoginPane />}
          {tab === 'signup' && <SignupForm />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={active ? tabActiveStyle : tabStyle}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// LoginPane: 通常のログインフォーム (保存済みフローと並列)
// ---------------------------------------------------------------------------

function LoginPane() {
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
      await auth.login({ pokerName, privatePass, groupKey });
      // 成功時、AuthContext 内で saveAccount が自動実行される
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === 'invalid_group_key') setError('グループキーが違います');
        else if (err.code === 'invalid_credentials') setError('名前またはパスワードが違います');
        else if (err.code === 'already_logged_in')
          setError('すでに他の端末でログイン中です');
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
          autoComplete="current-password"
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
        {submitting ? '送信中…' : 'ログイン'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const fullScreenStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: THEME.bg,
  padding: '1.5rem',
};

const loadingStyle: CSSProperties = {
  fontSize: '0.95rem',
  color: THEME.textMuted,
  letterSpacing: '0.1em',
};

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.7rem',
  padding: '1.5rem 1.25rem',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const cardHeaderStyle: CSSProperties = { textAlign: 'center' };
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.15rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const tabRowStyle: CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${THEME.border}`,
};
const tabBase: CSSProperties = {
  flex: 1,
  padding: '0.5rem 0',
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  fontSize: '0.84rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  color: THEME.textMuted,
  marginBottom: -1,
};
const tabStyle: CSSProperties = tabBase;
const tabActiveStyle: CSSProperties = {
  ...tabBase,
  color: THEME.accent,
  borderBottomColor: THEME.accent,
  fontWeight: 600,
};

const paneStyle: CSSProperties = { display: 'flex', flexDirection: 'column' };

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
const kickedNoticeStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: '#7B5A3E',
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '0.35rem',
  padding: '0.5rem 0.7rem',
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
