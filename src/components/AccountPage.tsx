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
import { apiGetStatistics, type StatisticsResponse, type StatGroup } from '../api/statistics';
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
  const [stats, setStats] = useState<StatisticsResponse | null>(null);

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
    // 統計は失敗してもメイン画面を壊さないため別 fetch + silent fallback
    apiGetStatistics(sid)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        /* silent */
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

        {stats && (stats.by_position.length > 0 || stats.by_scenario.length > 0) && (
          <>
            <StatsSection
              title="正答率(ポジション別)"
              groups={stats.by_position}
              ordering={POSITION_ORDER}
              labelOf={(k) => k}
            />
            <StatsSection
              title="正答率(シナリオ別)"
              groups={stats.by_scenario}
              ordering={SCENARIO_ORDER}
              labelOf={(k) => SCENARIO_LABEL[k] ?? k}
            />
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 統計セクション
// ---------------------------------------------------------------------------

const POSITION_ORDER = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const SCENARIO_ORDER = [
  'bb_response',
  'vs_3bet',
  'vs_4bet',
  'middle_vs_open',
  'risky_open',
  'beginner_open',
  'beginner_vs_open',
];
const SCENARIO_LABEL: Record<string, string> = {
  bb_response: 'vs open (BB)',
  vs_3bet: 'vs 3bet',
  vs_4bet: 'vs 4bet',
  middle_vs_open: 'vs open (BTN/SB)',
  risky_open: 'open (際どい)',
  beginner_open: 'オープン (初級)',
  beginner_vs_open: 'vs open (初級)',
};

function StatsSection({
  title,
  groups,
  ordering,
  labelOf,
}: {
  title: string;
  groups: StatGroup[];
  ordering: string[];
  labelOf: (key: string) => string;
}) {
  if (groups.length === 0) return null;
  // ordering 順 → 残り (アルファベット順) の順に並べる
  const orderIndex = (k: string) => {
    const i = ordering.indexOf(k);
    return i < 0 ? ordering.length + k.charCodeAt(0) : i;
  };
  const sorted = [...groups].sort((a, b) => orderIndex(a.key) - orderIndex(b.key));
  return (
    <section style={statsSectionStyle} aria-label={title}>
      <header style={statsHeaderStyle}>{title}</header>
      <ul style={statsListStyle}>
        {sorted.map((g) => (
          <li key={g.key} style={statsRowStyle}>
            <span style={statsLabelStyle}>{labelOf(g.key) || g.key}</span>
            <span style={statsPctStyle}>{g.correct_rate.toFixed(1)}%</span>
            <span style={statsCountStyle}>({g.total}問)</span>
          </li>
        ))}
      </ul>
    </section>
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

const statsSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  marginTop: '0.6rem',
};
const statsHeaderStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#993C1D',
  padding: '0 0 0 8px',
  borderLeft: '3px solid #993C1D',
};
const statsListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: '0.4rem 0.65rem',
  background: '#fff',
  border: '0.5px solid #D3D1C7',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
};
const statsRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto',
  alignItems: 'baseline',
  gap: '0.65rem',
  padding: '0.4rem 0',
  fontSize: '0.88rem',
  borderBottom: `1px dashed ${THEME.border}`,
};
const statsLabelStyle: CSSProperties = {
  color: THEME.textPrimary,
};
const statsPctStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 700,
  color: '#639922',
  minWidth: '3.5rem',
  textAlign: 'right',
};
const statsCountStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textMuted,
  minWidth: '3rem',
  textAlign: 'right',
};
