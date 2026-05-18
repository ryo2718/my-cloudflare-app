// /account: アカウント情報ページ (Phase 10 で training 成績を詳細化)。
//
// レイアウト:
//   ユーザー: <poker_name>
//   累計ポイント: <points>pt
//   ── トレーニング成績 ──
//   プリフロップ初級
//     ベスト: 15/20 (75%)
//     挑戦回数: 3回
//   プリフロップ中級
//     未挑戦
//   プリフロップ上級 ... 未実装
//   ...

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
  formatScorePct,
  isPlanned,
  isPlayable,
  maxScoreFor,
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
  // 累計ポイント: training_results の best_score × points/問 の合計 (実装済 level のみ)
  const totalPoints = state.kind === 'ok' ? computeTotalPoints(state.trainings) : 0;
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
          <span style={infoLabelStyle}>累計ポイント</span>
          <span style={infoValuePrimaryStyle}>
            {state.kind === 'loading' ? '…' : `${totalPoints}pt`}
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
                {cat.levels.map((lv) => (
                  <li key={lv.key} style={levelRowStyle}>
                    <LevelStat
                      level={lv}
                      record={trainings.find((t) => t.training_type === lv.key)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </main>
    </div>
  );
}

function LevelStat({
  level,
  record,
}: {
  level: TrainingLevel;
  record: TrainingResult | undefined;
}) {
  if (!isPlanned(level)) {
    return (
      <div style={levelStatGroupStyle}>
        <span style={levelLabelStyle}>{level.label}</span>
        <span style={statusUnimplementedStyle}>未実装</span>
      </div>
    );
  }
  if (!isPlayable(level)) {
    return (
      <div style={levelStatGroupStyle}>
        <span style={levelLabelStyle}>{level.label}</span>
        <span style={statusUnimplementedStyle}>準備中</span>
      </div>
    );
  }
  if (!record) {
    return (
      <div style={levelStatGroupStyle}>
        <span style={levelLabelStyle}>{level.label}</span>
        <span style={statusInfoStyle}>未挑戦</span>
      </div>
    );
  }
  const max = maxScoreFor(level);
  return (
    <div style={levelStatGroupStyle}>
      <span style={levelLabelStyle}>{level.label}</span>
      <div style={levelDetailColStyle}>
        <span style={levelDetailRowStyle}>
          ベスト: <strong>{record.best_score}/{max}</strong>{' '}
          <span style={pctGreenStyle}>({formatScorePct(record.best_score, max)})</span>
        </span>
        <span style={levelDetailSubStyle}>挑戦回数: {record.total_attempts}回</span>
      </div>
    </div>
  );
}

function computeTotalPoints(trainings: TrainingResult[]): number {
  // 各 level の points/問 を catalog から引いて、best_score × points/問 を集計
  const ptMap = new Map<string, number>();
  for (const cat of TRAINING_CATALOG) {
    for (const lv of cat.levels) {
      if (lv.points !== null) ptMap.set(lv.key, lv.points);
    }
  }
  let total = 0;
  for (const t of trainings) {
    const p = ptMap.get(t.training_type) ?? 0;
    total += p * t.best_score;
  }
  return total;
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
  fontSize: '1.1rem',
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
  padding: '0.3rem 0',
  borderBottom: `1px dashed ${THEME.border}`,
  fontSize: '0.88rem',
};

const levelStatGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.65rem',
};

const levelLabelStyle: CSSProperties = {
  color: THEME.textPrimary,
  fontWeight: 500,
};

const levelDetailColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '0.15rem',
  textAlign: 'right',
};

const levelDetailRowStyle: CSSProperties = {
  color: THEME.textPrimary,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.85rem',
};

const levelDetailSubStyle: CSSProperties = {
  color: THEME.textMuted,
  fontSize: '0.78rem',
};

const pctGreenStyle: CSSProperties = {
  color: '#639922',
  fontWeight: 700,
};

const statusInfoStyle: CSSProperties = {
  color: THEME.textMuted,
  fontSize: '0.85rem',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};

const statusUnimplementedStyle: CSSProperties = {
  color: THEME.textFaint,
  fontSize: '0.78rem',
};

const errorStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.4rem 0.6rem',
};
