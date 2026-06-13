// 保存済みアカウント一覧タブ。
//
// 構造:
//   - SavedAccountCard を縦に並べる
//   - その下に Group Key 入力 (毎回入力させる、保存しない)
//   - 最下部に「別のアカウントでログイン」リンク (親に通知して別タブへ)
//
// ログインフロー:
//   1. group_key 入力チェック
//   2. auth.login({pokerName, privatePass: saved.private_pass, groupKey})
//   3. 成功 → 自動でホームへ遷移 (AuthContext 経由)
//   4. 失敗 → エラー表示。invalid_credentials なら「パス変更されたかも、削除推奨」hint

import { useState, type CSSProperties } from 'react';
import { AuthApiError } from '../api/auth';
import {
  deleteSavedAccount,
  type SavedAccount,
} from '../data/savedAccounts';
import { useAuth } from '../hooks/useAuth';
import { THEME } from '../styles/theme';
import { SavedAccountCard } from './SavedAccountCard';

export interface SavedAccountsTabProps {
  /** 親 (LoginGate) から渡される最新リスト。 */
  accounts: ReadonlyArray<SavedAccount>;
  /** 削除後に親に通知してリストを再描画させる。 */
  onListChange: () => void;
  /** 「別のアカウントでログイン」クリックで親が呼ぶ (タブ切替)。 */
  onSwitchToLoginTab: () => void;
}

export function SavedAccountsTab({
  accounts,
  onListChange,
  onSwitchToLoginTab,
}: SavedAccountsTabProps) {
  const auth = useAuth();
  const [groupKey, setGroupKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);

  const handleLogin = async (account: SavedAccount) => {
    setError(null);
    // group_key は任意 (tester / VIP / admin はサーバ側で免除)。空でも送信する。
    setBusyName(account.poker_name);
    try {
      await auth.login({
        pokerName: account.poker_name,
        privatePass: account.private_pass,
        groupKey: groupKey.trim(),
      });
      // 成功時は AuthContext が status='authenticated' に切替、LoginGate がアンマウントされる
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === 'invalid_group_key') {
          setError('Group Key が違います');
        } else if (err.code === 'invalid_credentials') {
          setError(
            `${account.poker_name} のパスワードがサーバ側と一致しません。`
            + '（パスワードが変わった可能性。削除して再ログインを推奨）',
          );
        } else if (err.code === 'already_logged_in') {
          setError('すでに他の端末でログイン中です');
        } else {
          setError(`エラー: ${err.code}`);
        }
      } else {
        setError(err instanceof Error ? err.message : '不明なエラー');
      }
    } finally {
      setBusyName(null);
    }
  };

  const handleDelete = (account: SavedAccount) => {
    deleteSavedAccount(account.poker_name);
    onListChange();
  };

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>アカウントを選択</h2>

      <div style={listStyle}>
        {accounts.map((a) => (
          <SavedAccountCard
            key={a.poker_name}
            account={a}
            onLogin={() => handleLogin(a)}
            onDelete={() => handleDelete(a)}
            disabled={busyName !== null && busyName !== a.poker_name}
          />
        ))}
      </div>

      <div style={dividerStyle} />

      <label style={groupKeyLabelStyle}>
        <span style={groupKeyHintStyle}>グループキー (月次更新・テスター/VIP は不要)</span>
        <input
          type="text"
          value={groupKey}
          onChange={(e) => setGroupKey(e.target.value)}
          placeholder="Group Key (任意)"
          style={groupKeyInputStyle}
          autoComplete="off"
        />
      </label>

      {error && <div style={errorStyle}>{error}</div>}

      <button
        type="button"
        onClick={onSwitchToLoginTab}
        style={switchLinkStyle}
      >
        別のアカウントでログイン →
      </button>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
};

const headerStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  letterSpacing: '0.02em',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
  maxHeight: '50vh',
  overflowY: 'auto',
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: THEME.border,
  margin: '0.3rem 0',
};

const groupKeyLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
};

const groupKeyHintStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textSecondary,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const groupKeyInputStyle: CSSProperties = {
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

const switchLinkStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: THEME.accent,
  fontSize: '0.85rem',
  fontWeight: 600,
  textAlign: 'right',
  padding: '0.25rem 0',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
