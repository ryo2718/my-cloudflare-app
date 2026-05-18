// /ranking: 累計 pt の順位表 (pt 数値は非公開、順位と名前のみ表示)。
//
// マウント時に GET /api/ranking → 全アカウントの順位 + my_rank を取得。
// 自分の行は ★ + 太字 + 背景ハイライトで強調。

import { useEffect, useState, type CSSProperties } from 'react';
import { apiRanking, type RankingResponse } from '../api/ranking';
import { useAuth } from '../hooks/useAuth';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: RankingResponse };

export function RankingPage() {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    apiRanking(sid)
      .then((data) => {
        if (cancelled) return;
        setState({ kind: 'ok', data });
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
      <AppHeader showBack />
      <main style={mainStyle}>
        <h1 style={titleStyle}>ランキング</h1>

        {state.kind === 'loading' && <div style={infoStyle}>読み込み中…</div>}
        {state.kind === 'error' && (
          <div style={errorStyle}>取得失敗: {state.message}</div>
        )}
        {state.kind === 'ok' && (
          <>
            {auth.account?.is_admin && (
              <div style={adminNoteStyle}>
                ※ 管理者アカウントはランキング対象外です。
              </div>
            )}
            <RankingList data={state.data} myAccountName={auth.account?.poker_name ?? ''} />
          </>
        )}
      </main>
    </div>
  );
}

function RankingList({
  data,
  myAccountName,
}: {
  data: RankingResponse;
  myAccountName: string;
}) {
  if (data.ranking.length === 0) {
    return <div style={infoStyle}>まだランキングデータがありません。</div>;
  }
  return (
    <ul style={listStyle}>
      {data.ranking.map((row) => {
        const isMe = data.my_rank === row.rank && row.poker_name === myAccountName;
        return (
          <li
            key={`${row.rank}-${row.poker_name}`}
            style={isMe ? rowMeStyle : rowStyle}
            aria-label={isMe ? '自分の順位' : undefined}
          >
            <span style={rankStyle}>{row.rank}位</span>
            <span style={isMe ? nameMeStyle : nameStyle}>
              {isMe && <span style={starStyle}>★ </span>}
              {row.poker_name}
            </span>
          </li>
        );
      })}
    </ul>
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
  padding: '1.25rem 1rem',
  maxWidth: 520,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};
const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.85rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  padding: '0.65rem 0.95rem',
  fontSize: '0.95rem',
};
const rowMeStyle: CSSProperties = {
  ...rowStyle,
  background: '#FAEEDA',
  borderColor: '#E5A551',
  fontWeight: 700,
};
const rankStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 700,
  color: THEME.textSecondary,
  minWidth: '3.5rem',
};
const nameStyle: CSSProperties = {
  color: THEME.textPrimary,
};
const nameMeStyle: CSSProperties = {
  color: '#993C1D',
  fontWeight: 700,
};
const starStyle: CSSProperties = {
  color: '#E5A551',
};
const infoStyle: CSSProperties = {
  color: THEME.textMuted,
  fontSize: '0.9rem',
};
const adminNoteStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  background: '#FAEEDA',
  border: '1px dashed #E5A551',
  borderRadius: '0.35rem',
  padding: '0.4rem 0.6rem',
};

const errorStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.5rem 0.7rem',
};
