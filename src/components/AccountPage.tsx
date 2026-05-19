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
  apiAccountAchievements,
  apiAccountTrainingResults,
  apiResetResults,
  type AccountDetail,
  type TrainingResult,
} from '../api/account';
import { apiGetStatistics, type StatisticsResponse, type StatGroup } from '../api/statistics';
import { useAuth } from '../hooks/useAuth';
import { AchievementsSection } from './AchievementsSection';
import {
  TRAINING_CATALOG,
  formatScorePct,
  isPlanned,
  isPlayable,
  maxScoreFor,
  type TrainingLevel,
} from '../data/trainingCatalog';
import { AppHeader } from './AppHeader';
import { calculateRank } from '../utils/rank';
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
  const [unlocked, setUnlocked] = useState<string[] | null>(null);

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
    // 実績取得 (サーバー側で評価 + 新規アンロックを INSERT)
    apiAccountAchievements(sid)
      .then((res) => {
        if (!cancelled) setUnlocked(res.unlocked);
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
  const currentSeasonId = state.kind === 'ok' ? state.detail.season.id : null;
  const seasonName = state.kind === 'ok' ? state.detail.season.name : null;
  const seasonPoints =
    state.kind === 'ok'
      ? computeSeasonPoints(state.trainings, state.detail.season.id)
      : 0;

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <h1 style={titleStyle}>アカウント情報</h1>
        <div style={dividerStyle} />

        <RankHero
          pokerName={pokerName}
          seasonPoints={seasonPoints}
          totalPoints={totalPoints}
          unlocked={unlocked}
          loading={state.kind === 'loading'}
        />
        {seasonName && currentSeasonId && (
          <div style={seasonNoteStyle}>{seasonName}</div>
        )}

        <AchievementsSection unlocked={unlocked ?? []} />

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

        <StatsSection
          title="正答率(ポジション別)"
          rows={buildPositionRows(stats)}
        />
        <StatsSection
          title="正答率(シナリオ別)"
          rows={buildScenarioRows(stats)}
        />

        <ResetResultsSection />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 統計セクション
// ---------------------------------------------------------------------------

const POSITION_ORDER = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

// シナリオ集約: scenario_type を 4 種類にまとめて表示する
const SCENARIO_GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: 'open', label: 'オープン', types: ['beginner_open', 'risky_open'] },
  {
    key: 'vs_open',
    label: 'vs オープン',
    types: ['beginner_vs_open', 'bb_response', 'middle_vs_open'],
  },
  { key: 'vs_3bet', label: 'vs 3bet', types: ['vs_3bet'] },
  { key: 'vs_4bet', label: 'vs 4bet', types: ['vs_4bet'] },
];

interface StatsRow {
  key: string;
  label: string;
  total: number;
  correctRate: number;
}

function buildPositionRows(stats: StatisticsResponse | null): StatsRow[] {
  const map = new Map<string, StatGroup>();
  for (const g of stats?.by_position ?? []) map.set(g.key, g);
  return POSITION_ORDER.map((pos) => {
    const g = map.get(pos);
    return {
      key: pos,
      label: pos,
      total: g?.total ?? 0,
      correctRate: g?.correct_rate ?? 0,
    };
  });
}

function buildScenarioRows(stats: StatisticsResponse | null): StatsRow[] {
  const map = new Map<string, StatGroup>();
  for (const g of stats?.by_scenario ?? []) map.set(g.key, g);
  return SCENARIO_GROUPS.map(({ key, label, types }) => {
    let total = 0;
    let scoreSum = 0;
    let maxSum = 0;
    for (const t of types) {
      const g = map.get(t);
      if (!g) continue;
      total += g.total;
      scoreSum += g.score_sum;
      maxSum += g.max_sum;
    }
    return {
      key,
      label,
      total,
      correctRate: maxSum > 0 ? (scoreSum / maxSum) * 100 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// ランクヒーローカード (アイコン + ユーザー名 + ランクラベル + pt)
// ---------------------------------------------------------------------------

function RankHero({
  pokerName,
  seasonPoints,
  totalPoints,
  unlocked,
  loading,
}: {
  pokerName: string;
  seasonPoints: number;
  totalPoints: number;
  unlocked: string[] | null;
  loading: boolean;
}) {
  const rank = calculateRank(unlocked ?? []);
  const bg = rank.bg ?? '#f5f1ea';
  const border = rank.border ?? THEME.border;
  return (
    <section
      style={{ ...heroStyle, background: bg, borderColor: border }}
      aria-label="ランク"
    >
      <div style={heroIconStyle}>
        {rank.image ? (
          <img src={rank.image} alt="" style={heroIconImgStyle} loading="lazy" />
        ) : (
          <span style={heroIconPlaceholderStyle}>—</span>
        )}
      </div>
      <div style={heroTextColStyle}>
        <span style={{ ...heroNameStyle, color: rank.color }}>{pokerName}</span>
        <span style={{ ...heroRankStyle, color: rank.color }}>{rank.label}</span>
      </div>
      <div style={heroPtRowStyle}>
        <span style={{ ...heroPtStyle, color: rank.color }}>
          {loading ? '…' : `今シーズン ${seasonPoints}pt`}
        </span>
        <span style={{ ...heroPtStyle, color: rank.color }}>
          {loading ? '…' : `累計 ${totalPoints}pt`}
        </span>
      </div>
    </section>
  );
}

function ResetResultsSection() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // is_admin or is_ranking_excluded のユーザーのみ表示
  if (!auth.account?.is_admin && !auth.account?.is_ranking_excluded) return null;

  const handleReset = async () => {
    if (!auth.sessionId) return;
    if (!window.confirm('成績をリセットします。よろしいですか?')) return;
    setBusy(true);
    setErr(null);
    try {
      await apiResetResults(auth.sessionId);
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <section style={resetSectionStyle} aria-label="成績リセット">
      <button
        type="button"
        onClick={handleReset}
        disabled={busy}
        style={busy ? resetBtnDisabledStyle : resetBtnStyle}
      >
        {busy ? 'リセット中…' : '成績をリセット'}
      </button>
      <p style={resetNoteStyle}>
        training_results のみ削除されます。挑戦履歴は残ります。
      </p>
      {err && <div style={resetErrorStyle}>失敗: {err}</div>}
    </section>
  );
}

function StatsSection({ title, rows }: { title: string; rows: StatsRow[] }) {
  return (
    <section style={statsSectionStyle} aria-label={title}>
      <header style={statsHeaderStyle}>{title}</header>
      <ul style={statsListStyle}>
        {rows.map((r) => {
          const isEmpty = r.total === 0;
          return (
            <li key={r.key} style={statsRowStyle}>
              <span style={statsLabelStyle}>{r.label}</span>
              {isEmpty ? (
                <span style={statsNoDataStyle}>データなし</span>
              ) : (
                <>
                  <span style={statsPctStyle}>{r.correctRate.toFixed(1)}%</span>
                  <span style={statsCountStyle}>({r.total}問)</span>
                </>
              )}
            </li>
          );
        })}
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

/** 現シーズン分の pt 合計 (season_id 一致のみ、 season_score × points/問)。 */
function computeSeasonPoints(
  trainings: TrainingResult[],
  currentSeasonId: string,
): number {
  const ptMap = new Map<string, number>();
  for (const cat of TRAINING_CATALOG) {
    for (const lv of cat.levels) {
      if (lv.points !== null) ptMap.set(lv.key, lv.points);
    }
  }
  let total = 0;
  for (const t of trainings) {
    if (t.season_id !== currentSeasonId) continue;
    const p = ptMap.get(t.training_type) ?? 0;
    total += p * t.season_score;
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

const seasonNoteStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: '#5F5E5A',
  marginTop: '-0.2rem',
};

const heroStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gridTemplateRows: 'auto auto',
  columnGap: '0.85rem',
  rowGap: '0.4rem',
  alignItems: 'center',
  border: '2px solid',
  borderRadius: '0.6rem',
  padding: '0.85rem 1rem',
};
const heroIconStyle: CSSProperties = {
  gridRow: '1 / 3',
  width: 84,
  height: 84,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.35)',
  borderRadius: '50%',
};
const heroIconImgStyle: CSSProperties = {
  width: 78,
  height: 78,
  objectFit: 'contain',
};
const heroIconPlaceholderStyle: CSSProperties = {
  fontSize: '1.5rem',
  color: '#888780',
};
const heroTextColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.1rem',
};
const heroNameStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 800,
};
const heroRankStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  opacity: 0.9,
};
const heroPtRowStyle: CSSProperties = {
  gridColumn: '2 / 3',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.7rem',
};
const heroPtStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
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
const statsNoDataStyle: CSSProperties = {
  gridColumn: '2 / 4',
  fontSize: '0.82rem',
  color: THEME.textMuted,
  textAlign: 'right',
};

const resetSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '0.4rem',
  marginTop: '0.8rem',
  paddingTop: '0.8rem',
  borderTop: `1px solid ${THEME.border}`,
};
const resetBtnStyle: CSSProperties = {
  padding: '0.5rem 0.95rem',
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.35rem',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const resetBtnDisabledStyle: CSSProperties = {
  ...resetBtnStyle,
  color: THEME.textFaint,
  cursor: 'not-allowed',
  opacity: 0.6,
};
const resetNoteStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.74rem',
  color: THEME.textMuted,
};
const resetErrorStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.errorText,
};
const statsCountStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textMuted,
  minWidth: '3rem',
  textAlign: 'right',
};
