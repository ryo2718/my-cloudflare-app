// プリフロップ中級トレーニングの問題画面 (BB 応答シナリオ)。
//
// フロー:
//   1. マウント時に generateIntermediateQuestions() で 20 問生成
//   2. 各問: PokerTable + ハンド + IntermediateChoices (4 チェックボックス)
//   3. 20 秒タイマー、時間切れで scoreTimeout (-1pt)、ユーザー回答で scoreAnswer
//   4. 全 20 問完了で IntermediateRecord 配列を saveIntermediateRecords し /result へ
//
// 結果保存は記録 store (in-memory + sessionStorage) で result/review に渡す。

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generateIntermediateQuestions,
  scoreAnswer,
  scoreTimeout,
  type Action,
  type IntermediateQuestion,
} from '../../data/training/preflopIntermediate';
import {
  clearIntermediateRecords,
  saveIntermediateRecords,
  type IntermediateRecord,
} from '../../data/training/recordsStore';
import {
  trainingPath,
  type TrainingLevel,
} from '../../data/trainingCatalog';
import { apiPostMissedProblems, type MissedProblemInput } from '../../api/missedProblems';
import { apiPostProblemAttempts, type ProblemAttemptInput } from '../../api/statistics';
import { useAuth } from '../../hooks/useAuth';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import { ActionTable } from './ActionTable';
import { IntermediateChoices } from './IntermediateChoices';
import { intermediateScenarioLabel, rangeFileFor } from './intermediateScenarioLabel';
import { QuitButton } from './QuitButton';
import { InstantFeedback } from './InstantFeedback';
import { NodeRangeSection } from './NodeRangeSection';
import { loadInstantFeedback } from '../../data/userPreferences';
import type { Suit, Rank } from '../../types/card';

const TIMER_SECONDS = 20;

export interface TrainingPlayIntermediateProps {
  level: TrainingLevel;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      questions: IntermediateQuestion[];
      current: number;
      finalSum: number; // 全 final スコアの合計 (-1 を含む)
      records: IntermediateRecord[];
    };

export function TrainingPlayIntermediate({ level }: TrainingPlayIntermediateProps) {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const advancingRef = useRef(false);
  const [instant] = useState<boolean>(loadInstantFeedback);
  const [feedback, setFeedback] = useState<{ selections: ReadonlyArray<Action>; timedOut: boolean; points: number } | null>(null);
  // アクションアニメ完了 (= ヒーローの番) で制限時間を開始する。
  const [animReady, setAnimReady] = useState(false);
  const currentIdx = state.kind === 'ready' ? state.current : -1;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnimReady(false);
  }, [currentIdx]);

  // beforeunload: 途中離脱の警告
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.kind !== 'ready' || state.current >= state.questions.length) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    clearIntermediateRecords(level.key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    generateIntermediateQuestions()
      .then((questions) => {
        if (cancelled) return;
        setState({ kind: 'ready', questions, current: 0, finalSum: 0, records: [] });
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
  }, [level.key]);

  const advance = (
    selections: ReadonlyArray<Action>,
    timedOut: boolean,
    prev: LoadState,
  ) => {
    if (prev.kind !== 'ready') return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const q = prev.questions[prev.current];
    const breakdown = timedOut
      ? scoreTimeout(q.strategy)
      : scoreAnswer(q.strategy, selections);
    const newRecord: IntermediateRecord = {
      ...q,
      id: prev.current + 1,
      selections: timedOut ? [] : selections,
      timedOut,
      rawScore: breakdown.rawScore,
      finalScore: breakdown.finalScore,
      theoreticalMax: breakdown.theoreticalMax,
      strategySnapshot: q.strategy,
    };
    const newRecords = [...prev.records, newRecord];
    const newFinalSum = prev.finalSum + breakdown.finalScore;
    const next = prev.current + 1;

    if (next >= prev.questions.length) {
      saveIntermediateRecords(level.key, newRecords);
      // Step 1: 満点 (finalScore===2) 以外の問題を DB に記録 (復習・統計の基盤)。
      // ベスト努力で実行、失敗は silent (結果画面遷移は止めない)。
      if (auth.sessionId) {
        const missedRecords: MissedProblemInput[] = newRecords
          .filter((r) => r.finalScore < 2)
          .map((r) => ({
            training_type: 'preflop_intermediate' as const,
            scenario_type: r.scenarioType,
            hero_position: r.myPosition,
            opener_position: r.opener,
            three_bettor_position: r.threeBettor ?? null,
            hand: r.hand,
            user_selections: [...r.selections],
            gto_strategy: {
              allin: r.strategySnapshot.allin ?? 0,
              raise: r.strategySnapshot.raise ?? 0,
              call: r.strategySnapshot.call ?? 0,
              fold: r.strategySnapshot.fold ?? 0,
            },
            score_obtained: r.finalScore,
            is_timeout: r.timedOut,
          }));
        if (missedRecords.length > 0) {
          void apiPostMissedProblems(auth.sessionId, missedRecords).catch(() => {
            /* silent fallback */
          });
        }
        // Step 3b: 全 20 問を problem_attempts にも記録 (統計集計用)。
        const attemptRecords: ProblemAttemptInput[] = newRecords.map((r) => ({
          training_type: 'preflop_intermediate' as const,
          scenario_type: r.scenarioType,
          hero_position: r.myPosition,
          opener_position: r.opener,
          three_bettor_position: r.threeBettor ?? null,
          hand: r.hand,
          score_obtained: r.finalScore,
          is_timeout: r.timedOut,
        }));
        void apiPostProblemAttempts(auth.sessionId, attemptRecords).catch(() => {
          /* silent fallback */
        });
      }
      const params = new URLSearchParams({
        score: String(newFinalSum),
        total: String(prev.questions.length * 2), // 満点 40 (20 問 × 2pt)
        mode: 'intermediate',
      });
      navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
      return;
    }
    setState({
      kind: 'ready',
      questions: prev.questions,
      current: next,
      finalSum: newFinalSum,
      records: newRecords,
    });
    Promise.resolve().then(() => {
      advancingRef.current = false;
    });
  };

  // 回答受領: 即時フィードバック ON ならその場で答えを表示 (採点・記録は「次のハンドへ」で確定)。
  const handleResponse = (selections: ReadonlyArray<Action>, timedOut: boolean) => {
    if (state.kind !== 'ready') return;
    if (instant) {
      if (feedback) return;
      const q = state.questions[state.current];
      const breakdown = timedOut ? scoreTimeout(q.strategy) : scoreAnswer(q.strategy, selections);
      setFeedback({ selections, timedOut, points: breakdown.finalScore });
      return;
    }
    advance(selections, timedOut, state);
  };

  const proceed = () => {
    if (!feedback) return;
    const { selections, timedOut } = feedback;
    setFeedback(null);
    advance(selections, timedOut, state);
  };

  if (state.kind === 'loading') {
    return (
      <div style={pageStyle}>
        <div style={loadingStyle}>問題を生成中…</div>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div style={pageStyle}>
        <div style={errorStyle}>
          問題の生成に失敗しました: {state.message}
          <div>
            <button type="button" onClick={() => navigate('/quiz')} style={errorBtnStyle}>
              トレーニングに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = state.questions[state.current];
  const progress = ((state.current + 1) / state.questions.length) * 100;

  return (
    <div style={pageStyle}>
      <header style={headerBarStyle}>
        <div style={progressTopStyle}>
          <span style={progressLabelStyle}>
            {level.label}
          </span>
          <span style={progressCountStyle}>
            {state.current + 1} / {state.questions.length}
          </span>
          <QuitButton />
        </div>
        <div style={progressBarOuterStyle} aria-hidden>
          <div style={{ ...progressBarInnerStyle, width: `${progress}%` }} />
        </div>
      </header>

      {animReady && !feedback && (
        <Countdown
          key={`${state.current}-${q.hand}`}
          seconds={TIMER_SECONDS}
          onTimeUp={() => handleResponse([], true)}
        />
      )}

      <main style={mainStyle}>
        <div style={scenarioPillStyle}>{intermediateScenarioLabel(q)}</div>
        <ActionTable
          file={rangeFileFor(q)}
          mePosition={q.myPosition}
          animate
          resetKey={state.current}
          onAnimationDone={() => setAnimReady(true)}
        />

        <section style={handSectionStyle}>
          <span style={handLabelStyle}>ハンド</span>
          <CardSet
            cards={q.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
            size="lg"
            gap={6}
          />
        </section>

        {feedback ? (
          <InstantFeedback points={feedback.points} onNext={proceed}>
            <NodeRangeSection file={rangeFileFor(q)} highlightHand={q.hand} />
          </InstantFeedback>
        ) : (
          <IntermediateChoices
            // key で問題切り替え時に内部 state リセット
            key={`choices-${state.current}`}
            onSubmit={(selections) => handleResponse(selections, false)}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Countdown (中級専用、UI は初級 Countdown と類似)
// ---------------------------------------------------------------------------

function Countdown({
  seconds,
  onTimeUp,
}: {
  seconds: number;
  onTimeUp: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(seconds);
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      const newRemaining = Math.max(0, seconds - elapsedSec);
      setRemaining(newRemaining);
      if (newRemaining <= 0) {
        window.clearInterval(tick);
        onTimeUp();
      }
    }, 200);
    return () => window.clearInterval(tick);
  }, [seconds, onTimeUp]);

  const danger = remaining <= 5;
  return (
    <div
      style={{
        ...timerStyle,
        color: danger ? '#b91c1c' : THEME.textPrimary,
        borderColor: danger ? '#b91c1c' : THEME.border,
      }}
      aria-live="polite"
    >
      残り {remaining}s
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (初級 TrainingPlay と統一感のあるスタイル)
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: THEME.bg,
  display: 'flex',
  flexDirection: 'column',
};

const headerBarStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  padding: '0.7rem 1rem',
  background: '#fff',
  borderBottom: `1px solid ${THEME.border}`,
};
const progressTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontSize: '0.85rem',
};
const progressLabelStyle: CSSProperties = {
  fontWeight: 700,
  color: THEME.textPrimary,
};
const progressCountStyle: CSSProperties = {
  color: THEME.textSecondary,
  fontVariantNumeric: 'tabular-nums',
};
const progressBarOuterStyle: CSSProperties = {
  height: 6,
  background: THEME.cellEmpty,
  borderRadius: 3,
  overflow: 'hidden',
};
const progressBarInnerStyle: CSSProperties = {
  height: '100%',
  background: THEME.accent,
  transition: 'width 0.2s',
};

const mainStyle: CSSProperties = {
  flex: 1,
  padding: '1rem',
  maxWidth: 520,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
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

const timerStyle: CSSProperties = {
  alignSelf: 'center',
  margin: '0.5rem 0',
  padding: '0.3rem 0.8rem',
  border: '1.5px solid',
  borderRadius: '999px',
  fontSize: '0.95rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};

const loadingStyle: CSSProperties = {
  margin: 'auto',
  fontSize: '0.95rem',
  color: THEME.textMuted,
};

const errorStyle: CSSProperties = {
  margin: 'auto',
  fontSize: '0.92rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.4rem',
  padding: '1rem 1.2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
};

const errorBtnStyle: CSSProperties = {
  padding: '0.45rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.35rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
