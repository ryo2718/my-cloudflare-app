// プリフロップ中級総合トレーニングの問題画面。
//
// フロー:
//   1. マウント時に generateIntermediateQuestions() で 20 問生成
//   2. 各問: PokerTable + ハンド + IntermediateChoices (4 チェックボックス)
//   3. 20 秒タイマー、時間切れで scoreTimeout (-1pt)、ユーザー回答で scoreAnswer
//   4. 全 20 問完了で IntermediateRecord 配列を saveIntermediateRecords し /result へ
//
// 状態機械・回答処理・即時フィードバック・タイマー・離脱警告は共通の useTrainingHarness に集約。

import { useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generateIntermediateQuestions,
  scoreAnswer,
  scoreTimeout,
  ACTIONS,
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
import { ChoiceButtons } from './ChoiceButtons';
import { ACTION_LABEL } from './actionButtonStyle';
import { intermediateScenarioLabel } from './intermediateScenarioLabel';
import { QuitButton } from './QuitButton';
import { InstantFeedback } from './InstantFeedback';
import { NodeRangeSection } from './NodeRangeSection';
import { Countdown } from './Countdown';
import { useTrainingHarness } from './useTrainingHarness';
import { intermediateViewInfo } from './trainingViewInfo';
import { loadInstantFeedback } from '../../data/userPreferences';
import type { Suit, Rank } from '../../types/card';

const TIMER_SECONDS = 20;

export interface TrainingPlayIntermediateProps {
  level: TrainingLevel;
}

/** 回答 (選択 or 時間切れ)。 */
type IntermediateResponse = { selections: ReadonlyArray<Action>; timedOut: boolean };

export function TrainingPlayIntermediate({ level }: TrainingPlayIntermediateProps) {
  const auth = useAuth();
  const [instant] = useState<boolean>(loadInstantFeedback);

  const finish = (records: IntermediateRecord[]) => {
    saveIntermediateRecords(level.key, records);
    // Step 1: 満点 (finalScore===2) 以外の問題を DB に記録 (復習・統計の基盤)。
    // ベスト努力で実行、失敗は silent (結果画面遷移は止めない)。
    if (auth.sessionId) {
      const missedRecords: MissedProblemInput[] = records
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
      const attemptRecords: ProblemAttemptInput[] = records.map((r) => ({
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
    const finalSum = records.reduce((sum, r) => sum + r.finalScore, 0);
    const params = new URLSearchParams({
      score: String(finalSum),
      total: String(records.length * 2), // 満点 40 (20 問 × 2pt)
      mode: 'intermediate',
    });
    navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
  };

  const { state, animReady, setAnimReady, feedback, onAnswer, onProceed } = useTrainingHarness<
    IntermediateQuestion,
    IntermediateResponse,
    IntermediateRecord
  >({
    load: () => generateIntermediateQuestions(),
    onLoadStart: () => clearIntermediateRecords(level.key),
    reloadKey: level.key,
    instant,
    scorePoints: (q, res) =>
      (res.timedOut ? scoreTimeout(q.strategy) : scoreAnswer(q.strategy, res.selections)).finalScore,
    buildRecord: (q, res, i) => {
      const breakdown = res.timedOut ? scoreTimeout(q.strategy) : scoreAnswer(q.strategy, res.selections);
      return {
        ...q,
        id: i + 1,
        selections: res.timedOut ? [] : res.selections,
        timedOut: res.timedOut,
        rawScore: breakdown.rawScore,
        finalScore: breakdown.finalScore,
        theoreticalMax: breakdown.theoreticalMax,
        strategySnapshot: q.strategy,
      };
    },
    finish,
  });

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
  const view = intermediateViewInfo(q);
  const progress = ((state.current + 1) / state.questions.length) * 100;

  return (
    <div style={pageStyle}>
      <header style={headerBarStyle}>
        <div style={progressTopStyle}>
          <span style={progressLabelStyle}>{level.label}</span>
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
          onTimeUp={() => onAnswer({ selections: [], timedOut: true })}
        />
      )}

      <main style={mainStyle}>
        <div style={scenarioPillStyle}>{intermediateScenarioLabel(q)}</div>
        <ActionTable
          file={view.nodeFile}
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
          <InstantFeedback points={feedback.points} onNext={onProceed}>
            <NodeRangeSection file={view.nodeFile} highlightHand={view.hand} />
          </InstantFeedback>
        ) : (
          <ChoiceButtons
            // key で問題切り替え時に内部 state リセット
            key={`choices-${state.current}`}
            availableActions={ACTIONS}
            actionLabels={ACTION_LABEL}
            onSubmit={(selections) => onAnswer({ selections, timedOut: false })}
          />
        )}
      </main>
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
