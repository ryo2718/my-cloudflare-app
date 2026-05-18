// /ranking: 累計 pt の順位表。
//
// 表示:
//   - 通常ランキング: 上位 3 位は pt 公開、4 位以下は順位と名前のみ。同点同順位。
//   - 参考枠: is_ranking_excluded=1 のユーザー (admin 除外)、 pt は常に公開。
//   - 自分の行は ★ + 太字 + 背景ハイライト。

import { useEffect, useState, type CSSProperties } from 'react';
import {
  apiRanking,
  type RankingEntry,
  type RankingResponse,
  type ReferenceEntry,
} from '../api/ranking';
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

  const myName = auth.account?.poker_name ?? '';

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
            <RankingList data={state.data} myAccountName={myName} />
            {state.data.reference.length > 0 && (
              <ReferenceSection reference={state.data.reference} myAccountName={myName} />
            )}
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
      {data.ranking.map((row, idx) => (
        <RankingRow
          key={`${row.rank}-${row.poker_name}-${idx}`}
          row={row}
          isMe={data.my_rank === row.rank && row.poker_name === myAccountName}
        />
      ))}
    </ul>
  );
}

function RankingRow({ row, isMe }: { row: RankingEntry; isMe: boolean }) {
  return (
    <li
      style={isMe ? rowMeStyle : rowStyle}
      aria-label={isMe ? '自分の順位' : undefined}
    >
      <span style={rankStyle}>{row.rank}位</span>
      <span style={isMe ? nameMeStyle : nameStyle}>
        {isMe && <span style={starStyle}>★ </span>}
        {row.poker_name}
      </span>
      {row.points_visible && row.total_points !== null && (
        <span style={ptStyle}>{row.total_points}pt</span>
      )}
    </li>
  );
}

function ReferenceSection({
  reference,
  myAccountName,
}: {
  reference: ReferenceEntry[];
  myAccountName: string;
}) {
  return (
    <section style={referenceSectionStyle} aria-label="参考">
      <header style={referenceHeaderStyle}>参考</header>
      <ul style={listStyle}>
        {reference.map((row) => {
          const isMe = row.poker_name === myAccountName;
          return (
            <li
              key={row.poker_name}
              style={isMe ? referenceRowMeStyle : referenceRowStyle}
              aria-label={isMe ? '自分の行 (参考枠)' : undefined}
            >
              <span style={referenceNameStyle}>
                {isMe && <span style={starStyle}>★ </span>}
                {row.poker_name}
              </span>
              <span style={referencePtStyle}>{row.total_points}pt</span>
            </li>
          );
        })}
      </ul>
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
  flex: 1,
};
const nameMeStyle: CSSProperties = {
  color: '#993C1D',
  fontWeight: 700,
  flex: 1,
};
const starStyle: CSSProperties = {
  color: '#E5A551',
};
const ptStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 700,
  color: '#639922',
  fontVariantNumeric: 'tabular-nums',
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

const referenceSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginTop: '0.4rem',
  paddingTop: '0.7rem',
  borderTop: `1px solid ${THEME.border}`,
};
const referenceHeaderStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
};
const referenceRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.85rem',
  background: '#fafaf7',
  border: `1px dashed ${THEME.border}`,
  borderRadius: '0.4rem',
  padding: '0.6rem 0.9rem',
  fontSize: '0.9rem',
};
const referenceRowMeStyle: CSSProperties = {
  ...referenceRowStyle,
  background: '#FAEEDA',
  borderStyle: 'solid',
  borderColor: '#E5A551',
  fontWeight: 700,
};
const referenceNameStyle: CSSProperties = {
  color: THEME.textSecondary,
};
const referencePtStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 700,
  color: '#639922',
  fontVariantNumeric: 'tabular-nums',
};
