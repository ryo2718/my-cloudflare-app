// /account: アカウント情報ページ。
//
// レイアウト:
//   ユーザー: {poker_name}
//   ポイント: {points}pt
//   ── トレーニング成績 ──
//   プリフロップトレーニング
//     初級:   --- /20 (未挑戦)   or   18 /20
//     中級:   --- /20 (未挑戦)   or   12 /20
//     上級:   未実装
//     超上級: 未実装
//   フロップトレーニング
//     初級:   未実装
//     ...

import { useEffect, useState, type CSSProperties } from 'react';
import {
  apiAccountMe,
  apiAccountTrainingResults,
  type AccountDetail,
  type TrainingResult,
} from '../api/account';
import { useAuth } from '../hooks/useAuth';
import {
  TRAINING_CATALOG,
  isPlanned,
  type TrainingLevel,
} from '../data/trainingCatalog';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; detail: AccountDetail; trainings: TrainingResult[] };

export function AccountPage() {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    Promise.all([apiAccountMe(sid), apiAccountTrainingResults(sid)])
      .then(([detail, trainings]) => {
        if (cancelled) return;
        setState({ kind: 'ok', detail, trainings });
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

  const fallbackName = auth.account?.poker_name ?? '';
  const pokerName = state.kind === 'ok' ? state.detail.poker_name : fallbackName;
  const points = state.kind === 'ok' ? state.detail.points : 0;
  const trainings: TrainingResult[] = state.kind === 'ok' ? state.trainings : [];

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <h1 style={titleStyle}>アカウント情報</h1>
        <div style={dividerStyle} />

        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>ユーザー</span>
          <span style={infoValueStyle}>{pokerName}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>ポイント</span>
          <span style={infoValuePrimaryStyle}>
            {state.kind === 'loading' ? '…' : `${points}pt`}
          </span>
        </div>

        <div style={sectionLabelRowStyle}>
          <span style={sectionLabelStyle}>トレーニング成績</span>
        </div>

        {state.kind === 'error' && (
          <div style={errorStyle}>取得失敗: {state.message}</div>
        )}

        {state.kind !== 'error' &&
          TRAINING_CATALOG.map((cat) => (
            <section key={cat.key} style={categoryCardStyle}>
              <header style={categoryHeaderStyle}>{cat.label}</header>
              <ul style={levelListStyle}>
                {cat.levels.map((lv) => {
                  const record = trainings.find(
                    (t) => t.training_type === lv.key,
                  );
                  return (
                    <li key={lv.key} style={levelRowStyle}>
                      <span style={levelLabelStyle}>{renderLevelLabel(lv)}</span>
                      <span style={levelScoreStyle}>
                        {renderScore(lv, record)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </main>
    </div>
  );
}

function renderLevelLabel(lv: TrainingLevel): string {
  return lv.subtitle ? `${lv.label}(${lv.subtitle})` : lv.label;
}

function renderScore(lv: TrainingLevel, record: TrainingResult | undefined): string {
  if (!isPlanned(lv)) return '未実装';
  if (!record) return '--- /20 (未挑戦)';
  const total = lv.questionCount ?? 20;
  return `${record.best_score} /${total}`;
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

const infoRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.65rem',
};
const infoLabelStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.textSecondary,
};
const infoValueStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: THEME.textPrimary,
};
const infoValuePrimaryStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: THEME.accent,
  fontVariantNumeric: 'tabular-nums',
};

const sectionLabelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginTop: '0.4rem',
};
const sectionLabelStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: THEME.textSecondary,
};

const categoryCardStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.75rem 0.95rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const categoryHeaderStyle: CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};

const levelListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
};

const levelRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontSize: '0.88rem',
  padding: '0.25rem 0',
  borderBottom: `1px dashed ${THEME.border}`,
};

const levelLabelStyle: CSSProperties = {
  color: THEME.textPrimary,
};

const levelScoreStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  color: THEME.textSecondary,
  fontSize: '0.85rem',
};

const errorStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.4rem 0.6rem',
};
