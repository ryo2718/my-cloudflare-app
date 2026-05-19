// /quiz/review/{level}/answer/{id}: 答え合わせ画面 (復習)。
// missed_problems の 1 row を読んで、 GTO 戦略 / 選択 / 獲得点 / レンジを表示。
// 解き直しは不可、戻るで /quiz/review/{level}。
//
// データ: GET /api/account/missed-problems?level=... で全件取得して id でフィルタ。
// (専用 GET-by-id を増やさず、既存 API のみ利用。)

import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import { useAuth } from '../../hooks/useAuth';
import {
  apiGetMissedProblems,
  type MissedProblemRow,
} from '../../api/missedProblems';
import {
  recordToBeginnerQuestion,
  recordToIntermediateQuestion,
} from '../../data/training/reviewMode';
import { ACTIONS, type Action } from '../../data/training/preflopIntermediate';
import { ACTION_LABEL } from './IntermediateChoices';
import { CardSet } from '../CardSet';
import { HandRangeMatrix } from './HandRangeMatrix';
import { PokerTable } from './PokerTable';
import { AppHeader } from '../AppHeader';
import {
  intermediateScenarioLabel,
  rangeCaption,
  rangeFileFor,
} from './intermediateScenarioLabel';
import { THEME } from '../../styles/theme';
import type { Rank, Suit } from '../../types/card';
import type { HandStrategy, PreflopQuestion } from '../../data/training/preflopBeginner';
import type { IntermediateQuestion } from '../../data/training/preflopIntermediate';

export type MissedAnswerLevel = 'beginner' | 'intermediate';

const STRATEGY_COLORS: Record<Action, { check: string; text: string }> = {
  allin: { check: '#7F77DD', text: '#534AB7' },
  raise: { check: '#E24B4A', text: '#A32D2D' },
  call: { check: '#639922', text: '#3B6D11' },
  fold: { check: '#378ADD', text: '#185FA5' },
};

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'not_found' }
  | { kind: 'ok'; row: MissedProblemRow };

interface Props {
  level: MissedAnswerLevel;
  id: number;
}

export function MissedProblemAnswerPage({ level, id }: Props) {
  const auth = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    // 「消した」問題でも URL 直叩きで答えを見たいことがあるので includeRemoved=true
    apiGetMissedProblems(sid, { level, limit: 1000, includeRemoved: true })
      .then((rows) => {
        if (cancelled) return;
        const row = rows.find((r) => r.id === id);
        setState(row ? { kind: 'ok', row } : { kind: 'not_found' });
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
  }, [auth.sessionId, level, id]);

  const backPath = `/quiz/review/preflop/${level}`;

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <Link to={backPath} style={crumbStyle}>← 戻る</Link>
        <h1 style={titleStyle}>答え合わせ</h1>

        {state.kind === 'loading' && <div style={infoStyle}>読み込み中…</div>}
        {state.kind === 'error' && (
          <div style={errorStyle}>取得失敗: {state.message}</div>
        )}
        {state.kind === 'not_found' && (
          <div style={errorBoxStyle}>
            <span>該当の問題が見つかりません。</span>
            <button
              type="button"
              onClick={() => navigate(backPath)}
              style={errorBtnStyle}
            >
              戻る
            </button>
          </div>
        )}
        {state.kind === 'ok' &&
          (level === 'intermediate' ? (
            <IntermediateBody row={state.row} />
          ) : (
            <BeginnerBody row={state.row} />
          ))}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intermediate body
// ---------------------------------------------------------------------------

function IntermediateBody({ row }: { row: MissedProblemRow }) {
  const q = recordToIntermediateQuestion(row);
  if (!q) {
    return <div style={errorStyle}>データ復元失敗 (id={row.id})</div>;
  }
  const selections = parseSelections(row.user_selections);
  const score = row.score_obtained;
  const scoreColor =
    score < 0 ? '#7A2A26'
      : score === 0 ? '#5F5E5A'
        : score === 1 ? '#6B5A48'
          : '#1F4D11';

  return (
    <>
      <div style={scenarioPillStyle}>{intermediateScenarioLabel(q)}</div>

      <PokerTable
        mePosition={q.myPosition}
        opener={q.scenarioType === 'risky_open' ? null : q.opener}
        foldedSet={q.foldedBefore}
        chipExtras={q.chipExtras}
      />

      <section style={handSectionStyle}>
        <span style={handLabelStyle}>ハンド</span>
        <CardSet
          cards={q.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
          size="lg"
          gap={6}
        />
      </section>

      <section style={strategyTableStyle} aria-label="GTO 戦略">
        <header style={strategyHeaderStyle}>あなたの選択 / GTO 戦略</header>
        <ul style={strategyListStyle}>
          {ACTIONS.map((a) => {
            const freq = q.strategy[a] ?? 0;
            const picked = selections.includes(a);
            const col = STRATEGY_COLORS[a];
            return (
              <li key={a} style={strategyRowStyle}>
                <span style={{ ...pickBoxStyle, color: col.check }}>
                  {picked ? '☑' : '☐'}
                </span>
                <span style={{ ...actionNameStyle, color: col.text }}>
                  {ACTION_LABEL[a]}
                </span>
                <span style={{ ...freqStyle, color: col.text }}>
                  {formatFreq(freq)}%
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div style={scoreSummaryStyle}>
        <span style={scoreSummaryLabelStyle}>獲得点</span>
        <span style={{ ...scoreSummaryValueStyle, color: scoreColor }}>
          {score >= 0 ? `+${score}` : score}pt
        </span>
        {row.is_timeout === 1 && (
          <span style={timeoutBadgeStyle}>⏱ 時間切れ</span>
        )}
      </div>

      <IntermediateRangeSection q={q} hand={row.hand} />
    </>
  );
}

function IntermediateRangeSection({
  q,
  hand,
}: {
  q: IntermediateQuestion;
  hand: string;
}) {
  const file = rangeFileFor(q);
  const caption = rangeCaption(q);
  const [hands, setHands] = useState<Record<string, HandStrategy> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRangeFile(file)
      .then((h) => {
        if (!cancelled) setHands(h);
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!hands) return null;
  return (
    <section style={rangeSectionStyle} aria-label="このシナリオのレンジ">
      <HandRangeMatrix hands={hands} highlightHand={hand} caption={caption} />
    </section>
  );
}

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';
const rangeFileCache: Record<string, Record<string, HandStrategy>> = {};

async function fetchRangeFile(file: string): Promise<Record<string, HandStrategy>> {
  if (rangeFileCache[file]) return rangeFileCache[file];
  const res = await fetch(`${PREFLOP_DATA_ROOT}/${file}`);
  if (!res.ok) throw new Error(`failed to load ${file}: ${res.status}`);
  const raw = (await res.json()) as { hands: Record<string, HandStrategy> };
  rangeFileCache[file] = raw.hands;
  return raw.hands;
}

function formatFreq(pct: number): string {
  if (Math.abs(pct - Math.round(pct)) < 0.01) return String(Math.round(pct));
  return pct.toFixed(1);
}

function parseSelections(raw: string): Action[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Action =>
        a === 'allin' || a === 'raise' || a === 'call' || a === 'fold',
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Beginner body
// ---------------------------------------------------------------------------

function BeginnerBody({ row }: { row: MissedProblemRow }) {
  const q = recordToBeginnerQuestion(row);
  if (!q) {
    return <div style={errorStyle}>データ復元失敗 (id={row.id})</div>;
  }
  // user_selections は ['call'] / ['raise'] / ['fold'] のいずれかで保存されている。
  const userAnswer: 'participate' | 'fold' = beginnerUserAnswer(row);
  const scoreColor = row.score_obtained > 0 ? '#1F4D11' : '#7A2A26';

  return (
    <>
      <div style={scenarioPillStyle}>{beginnerScenarioLabel(q)}</div>

      <PokerTable
        mePosition={q.myPosition}
        opener={q.opener}
        foldedSet={q.foldedBefore}
      />

      <section style={handSectionStyle}>
        <span style={handLabelStyle}>ハンド</span>
        <CardSet
          cards={q.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
          size="lg"
          gap={6}
        />
      </section>

      <section style={beginnerActionRowStyle}>
        <BeginnerAnswerCell
          label="参加"
          isCorrect={q.correct === 'participate'}
          isUserChoice={userAnswer === 'participate'}
        />
        <BeginnerAnswerCell
          label="参加しない"
          isCorrect={q.correct === 'fold'}
          isUserChoice={userAnswer === 'fold'}
        />
      </section>

      <div style={scoreSummaryStyle}>
        <span style={scoreSummaryLabelStyle}>獲得点</span>
        <span style={{ ...scoreSummaryValueStyle, color: scoreColor }}>
          {row.score_obtained > 0 ? `+${row.score_obtained}` : row.score_obtained}pt
        </span>
      </div>
    </>
  );
}

function BeginnerAnswerCell({
  label,
  isCorrect,
  isUserChoice,
}: {
  label: string;
  isCorrect: boolean;
  isUserChoice: boolean;
}) {
  const cellStyle: CSSProperties = {
    ...answerCellBaseStyle,
    ...(isCorrect ? correctCellStyle : incorrectCellStyle),
  };
  const mark = isCorrect ? '○' : '×';
  return (
    <div style={cellWrapStyle}>
      <button type="button" disabled style={cellStyle} aria-disabled>
        <span style={markStyle}>{mark}</span>
        <span>{label}</span>
      </button>
      {isUserChoice && (
        <span
          style={isCorrect ? userBadgeCorrectStyle : userBadgeIncorrectStyle}
          aria-label="あなたの解答"
        >
          ↑ あなた
        </span>
      )}
      {isCorrect && !isUserChoice && (
        <span style={correctBadgeStyle} aria-label="正解">
          ↑ 正解
        </span>
      )}
    </div>
  );
}

function beginnerUserAnswer(row: MissedProblemRow): 'participate' | 'fold' {
  try {
    const parsed = JSON.parse(row.user_selections) as unknown;
    if (Array.isArray(parsed) && parsed.includes('fold')) return 'fold';
    if (Array.isArray(parsed) && parsed.length > 0) return 'participate';
  } catch {
    /* fallthrough */
  }
  // フォールバック: score_obtained ≤ 0 → 不正解 → 正解の反対を選んだと推定
  // (記録には限定情報しかないので、ベストエフォート)
  return row.score_obtained > 0 ? 'participate' : 'fold';
}

function beginnerScenarioLabel(q: PreflopQuestion): string {
  if (q.scenario === 'open') return `${q.myPosition} オープン判定`;
  return `vs ${q.opener} open`;
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
  padding: '1rem',
  maxWidth: 520,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
};
const crumbStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textSecondary,
  textDecoration: 'none',
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.2rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const infoStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.textMuted,
  padding: '0.5rem 0',
};
const errorStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.45rem 0.7rem',
};
const errorBoxStyle: CSSProperties = {
  padding: '1rem 1.2rem',
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  color: THEME.errorText,
  borderRadius: '0.4rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
const errorBtnStyle: CSSProperties = {
  padding: '0.45rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.35rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
const scenarioPillStyle: CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#993C1D',
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '999px',
  padding: '0.2rem 0.7rem',
};
const handSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.4rem',
};
const handLabelStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textSecondary,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
const strategyTableStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.7rem 0.85rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
};
const strategyHeaderStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
};
const strategyListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
};
const strategyRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px 1fr auto',
  alignItems: 'center',
  gap: '0.55rem',
  fontSize: '0.9rem',
  color: THEME.textPrimary,
};
const pickBoxStyle: CSSProperties = {
  fontSize: '1rem',
  textAlign: 'center',
};
const actionNameStyle: CSSProperties = {
  fontWeight: 600,
};
const freqStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 600,
};
const scoreSummaryStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '0.55rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.7rem 0.85rem',
};
const scoreSummaryLabelStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  fontWeight: 600,
};
const scoreSummaryValueStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
};
const timeoutBadgeStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#b91c1c',
};
const rangeSectionStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.7rem 0.85rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

// Beginner answer cell styles
const beginnerActionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.7rem',
};
const cellWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  alignItems: 'center',
};
const answerCellBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.35rem',
  padding: '0.85rem 1rem',
  borderRadius: '0.45rem',
  fontSize: '1rem',
  fontWeight: 700,
  width: '100%',
  fontFamily: 'inherit',
  cursor: 'not-allowed',
};
const correctCellStyle: CSSProperties = {
  background: '#E5F5DC',
  color: '#1F4D11',
  border: '2px solid #6B9C3C',
};
const incorrectCellStyle: CSSProperties = {
  background: '#F7E3E2',
  color: '#7A2A26',
  border: '2px solid #C25855',
};
const markStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 900,
};
const userBadgeCorrectStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#1F4D11',
};
const userBadgeIncorrectStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#993C1D',
};
const correctBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#3F6A1B',
};
