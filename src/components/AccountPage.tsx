// /account: アカウント情報ページ (Phase 8 で枠だけ実装)。
// 現状はポイント (常に 0) と トレーニング成績 (空) のプレースホルダ。

import { useEffect, useState, type CSSProperties } from 'react';
import { apiAccountMe, type AccountDetail } from '../api/account';
import { useAuth } from '../hooks/useAuth';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; detail: AccountDetail };

export function AccountPage() {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    apiAccountMe(sid)
      .then((detail) => {
        if (cancelled) return;
        setState({ kind: 'ok', detail });
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

  // poker_name は auth.account からも取れる (即時表示用)
  const fallbackName = auth.account?.poker_name ?? '';
  const detail = state.kind === 'ok' ? state.detail : null;
  const points = detail?.points ?? 0;
  const trainings = detail?.training_results ?? [];

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <h1 style={titleStyle}>アカウント情報</h1>
        <div style={dividerStyle} />

        <div style={nameRowStyle}>
          <span style={nameLabelStyle}>poker_name</span>
          <span style={nameValueStyle}>{detail?.poker_name ?? fallbackName}</span>
        </div>

        <section style={cardStyle}>
          <header style={cardHeaderStyle}>
            <span style={cardIconStyle}>📍</span>
            <span style={cardTitleStyle}>ポイント</span>
          </header>
          <div style={pointsValueStyle}>{state.kind === 'loading' ? '…' : points}</div>
          <div style={cardSubStyle}>(今後アップデート予定)</div>
        </section>

        <section style={cardStyle}>
          <header style={cardHeaderStyle}>
            <span style={cardIconStyle}>📊</span>
            <span style={cardTitleStyle}>トレーニング成績</span>
          </header>
          {state.kind === 'loading' && <div style={cardSubStyle}>読み込み中…</div>}
          {state.kind === 'error' && (
            <div style={errorStyle}>取得失敗: {state.message}</div>
          )}
          {state.kind === 'ok' && trainings.length === 0 && (
            <div style={cardSubStyle}>まだデータがありません</div>
          )}
          {state.kind === 'ok' && trainings.length > 0 && (
            <ul style={trainingListStyle}>
              {trainings.map((t) => (
                <li key={t.id} style={trainingItemStyle}>
                  <span>{t.training_type}</span>
                  <span>{t.score}</span>
                </li>
              ))}
            </ul>
          )}
          <div style={cardSubStyle}>(今後アップデート予定)</div>
        </section>
      </main>
    </div>
  );
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
  maxWidth: 520,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.2rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: THEME.border,
};

const nameRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.65rem',
};
const nameLabelStyle: CSSProperties = {
  fontSize: '0.72rem',
  letterSpacing: '0.04em',
  color: THEME.textSecondary,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};
const nameValueStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: THEME.textPrimary,
};

const cardStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.55rem',
  padding: '0.95rem 1.05rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};
const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.45rem',
};
const cardIconStyle: CSSProperties = { fontSize: '1.15rem', lineHeight: 1 };
const cardTitleStyle: CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const cardSubStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: THEME.textMuted,
};

const pointsValueStyle: CSSProperties = {
  fontSize: '2rem',
  fontWeight: 700,
  color: THEME.accent,
  fontVariantNumeric: 'tabular-nums',
};

const errorStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.4rem 0.6rem',
};

const trainingListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
};
const trainingItemStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.85rem',
};
