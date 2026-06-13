// 保存済みアカウント 1 件のカード UI。
//
// 表示:
//   👤 <poker_name>
//   前回: yyyy/MM/dd HH:mm
//   [ログイン] [削除]
//
// ロジックは持たない (純粋プレゼンテーション、handler は props)。
// disabled=true でログイン中の他カードを操作不能にする。

import { type CSSProperties } from 'react';
import type { SavedAccount } from '../data/savedAccounts';
import { THEME } from '../styles/theme';
import { RoleBadge, type RoleBadgeKind } from './RoleBadge';

export interface SavedAccountCardProps {
  account: SavedAccount;
  onLogin: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

function formatLastUsed(ms: number): string {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 肩書き (優先 admin > tester > VIP、1 つだけ)。該当なしは null。VIP は残り日数付き。 */
function roleOf(account: SavedAccount): { kind: RoleBadgeKind; days?: number } | null {
  if (account.is_admin) return { kind: 'admin' };
  if (account.tester) return { kind: 'tester' };
  if (account.vip_until != null && account.vip_until > Date.now()) {
    const days = Math.ceil((account.vip_until - Date.now()) / (24 * 60 * 60 * 1000));
    return { kind: 'vip', days };
  }
  return null;
}

export function SavedAccountCard({
  account,
  onLogin,
  onDelete,
  disabled = false,
}: SavedAccountCardProps) {
  return (
    <div style={cardStyle}>
      <div style={topRowStyle}>
        <span style={iconStyle} aria-hidden>
          👤
        </span>
        <div style={nameColStyle}>
          <span style={nameRowStyle}>
            <span style={nameStyle}>{account.poker_name}</span>
            {(() => {
              const role = roleOf(account);
              if (!role) return null;
              return (
                <>
                  <RoleBadge kind={role.kind} />
                  {role.kind === 'vip' && role.days != null && (
                    <span style={vipDaysStyle}>あと{role.days}日</span>
                  )}
                </>
              );
            })()}
          </span>
          <span style={lastUsedStyle}>前回: {formatLastUsed(account.last_used_at)}</span>
        </div>
      </div>
      <div style={btnRowStyle}>
        <button
          type="button"
          onClick={onLogin}
          disabled={disabled}
          style={disabled ? loginBtnDisabledStyle : loginBtnStyle}
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          style={disabled ? deleteBtnDisabledStyle : deleteBtnStyle}
          aria-label={`${account.poker_name} を保存済みから削除`}
        >
          削除
        </button>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.75rem 0.85rem',
};

const topRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.7rem',
};

const iconStyle: CSSProperties = {
  fontSize: '1.4rem',
  lineHeight: 1,
};

const nameColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
  flex: 1,
};

const nameRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.35rem',
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  fontSize: '0.98rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const vipDaysStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textMuted,
  whiteSpace: 'nowrap',
};

const lastUsedStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textMuted,
};

const btnRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'space-between',
};

const loginBtnStyle: CSSProperties = {
  flex: 1,
  padding: '0.42rem 0.8rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.3rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const loginBtnDisabledStyle: CSSProperties = {
  ...loginBtnStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const deleteBtnStyle: CSSProperties = {
  padding: '0.42rem 0.85rem',
  background: 'transparent',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const deleteBtnDisabledStyle: CSSProperties = {
  ...deleteBtnStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};
