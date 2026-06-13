// プリフロップ初級「vs 3bet/4bet」モードの問題画面 (複数選択)。
//   相手の 3bet / 4bet に対し allin/raise/call/fold を複数選択で回答。優しい採点 (0/1pt, 減点なし)。
//   1問1pt × 20問 = 20pt。best_score は正解数 (0-20)。
//   答え合わせは finish() で saveAnswerReview(level.key, records) を呼ぶだけ (フェーズ4 の統一構造)。
//   ※ 間違えた問題の記録 (apiPostMissedProblems) は本フェーズでは入れない (フェーズ6)。

import { useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generateBeginnerVs3Bet4BetQuestions,
  type BeginnerVs3Bet4BetQuestion,
} from '../../data/training/preflopBeginnerVs3Bet4Bet';
import { scoreGentleSelect } from '../../data/training/preflopBeginnerExt';
import {
  saveAnswerReview,
  clearAnswerReview,
  type AnswerReviewRecord,
} from '../../data/training/answerReviewStore';
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { THEME } from '../../styles/theme';
import { ActionTable } from './ActionTable';
import { CardSet } from '../CardSet';
import { ChoiceButtons } from './ChoiceButtons';
import { InstantFeedback } from './InstantFeedback';
import { NodeRangeSection } from './NodeRangeSection';
import { Countdown } from './Countdown';
import { QuitButton } from './QuitButton';
import { DebugAnswerBar } from './DebugAnswerBar';
import { useTrainingHarness } from './useTrainingHarness';
import { loadInstantFeedback } from '../../data/userPreferences';
import { useAuth } from '../../hooks/useAuth';
import { apiPostMissedProblems, type MissedProblemInput } from '../../api/missedProblems';
import type { StrategySymbol } from '../../utils/strategySymbol';
import type { Suit, Rank } from '../../types/card';

const TIMER_SECONDS = 50;

type SelectAction = 'allin' | 'raise' | 'call' | 'fold';
const SELECT_ACTIONS: ReadonlyArray<SelectAction> = ['allin', 'raise', 'call', 'fold'];
const ACTION_LABELS: Record<SelectAction, string> = {
  allin: 'オールイン',
  raise: 'レイズ',
  call: 'コール',
  fold: 'フォールド',
};

type VsResponse = { kind: 'select'; actions: ReadonlyArray<SelectAction> } | { kind: 'timeout' };
interface VsRecord {
  id: number;
  question: BeginnerVs3Bet4BetQuestion;
  response: VsResponse;
  points: number;
}

function scoreVs(q: BeginnerVs3Bet4BetQuestion, res: VsResponse): number {
  if (res.kind !== 'select' || res.actions.length === 0) return 0;
  return scoreGentleSelect(res.actions, q.strategy);
}

function vsJudgment(points: number): StrategySymbol {
  return points > 0 ? '○' : '✕';
}

/** シナリオ pill / 答え合わせ用ラベル (vs3bet=相手の3bet, vs4bet=相手の4bet に直面)。 */
function scenarioLabelOf(q: BeginnerVs3Bet4BetQuestion): string {
  return q.kind === 'vs3bet'
    ? `${q.hero} vs ${q.threebettor} 3bet`
    : `${q.hero} vs ${q.opener} 4bet`;
}

/** 頻度>0 のアクションを「レイズ80・コール20」形式で (答え合わせの正解表示)。 */
function correctTextOf(q: BeginnerVs3Bet4BetQuestion): string {
  const parts = SELECT_ACTIONS.filter((a) => (q.strategy[a] ?? 0) > 0).map(
    (a) => `${ACTION_LABELS[a]}${Math.round(q.strategy[a] ?? 0)}`,
  );
  return parts.length > 0 ? parts.join('・') : '—';
}

function userTextOf(res: VsResponse): string {
  if (res.kind !== 'select' || res.actions.length === 0) return '—';
  return res.actions.map((a) => ACTION_LABELS[a]).join('・');
}

export interface TrainingPlayBeginnerVs3Bet4BetProps {
  level: TrainingLevel;
}

export function TrainingPlayBeginnerVs3Bet4Bet({ level }: TrainingPlayBeginnerVs3Bet4BetProps) {
  const auth = useAuth();
  const [instant] = useState<boolean>(loadInstantFeedback);

  const finish = (records: VsRecord[]) => {
    // 間違えた問題 (不正解) を DB に記録 (ベスト努力・失敗は silent)。フェーズ6。
    if (auth.sessionId) {
      const missed: MissedProblemInput[] = records
        .filter((r) => !(r.points > 0))
        .map((r) => ({
          training_type: 'preflop_beginner_vs_3bet_4bet' as const,
          scenario_type: r.question.kind === 'vs3bet' ? 'beginner_vs_3bet' : 'beginner_vs_4bet',
          hero_position: r.question.hero,
          opener_position: r.question.opener,
          three_bettor_position: r.question.threebettor,
          hand: r.question.hand,
          user_selections: r.response.kind === 'select' ? [...r.response.actions] : [],
          gto_strategy: {
            allin: r.question.strategy.allin ?? 0,
            raise: r.question.strategy.raise ?? 0,
            call: r.question.strategy.call ?? 0,
            fold: r.question.strategy.fold ?? 0,
          },
          score_obtained: -1,
          is_timeout: r.response.kind === 'timeout',
        }));
      if (missed.length > 0) {
        void apiPostMissedProblems(auth.sessionId, missed).catch(() => {
          /* silent fallback */
        });
      }
    }
    // 統一答え合わせ構造へ保存 (これだけで結果画面の答え一覧＋振り返りが自動表示される)。
    const review: AnswerReviewRecord[] = records.map((r) => ({
      id: r.id,
      scenario: scenarioLabelOf(r.question),
      hand: r.question.hand,
      nodeFile: r.question.nodeFile,
      mePosition: r.question.hero,
      correct: r.points > 0,
      userText: userTextOf(r.response),
      correctText: correctTextOf(r.question),
    }));
    saveAnswerReview(level.key, review);
    const correctCount = records.filter((r) => r.points > 0).length;
    const params = new URLSearchParams({ score: String(correctCount), total: String(records.length) });
    navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
  };

  const { state, animReady, setAnimReady, feedback, onAnswer, onProceed, debugComplete } = useTrainingHarness<
    BeginnerVs3Bet4BetQuestion,
    VsResponse,
    VsRecord
  >({
    load: () => generateBeginnerVs3Bet4BetQuestions(),
    onLoadStart: () => clearAnswerReview(level.key),
    reloadKey: level.key,
    instant,
    scorePoints: scoreVs,
    buildRecord: (q, res, i) => ({ id: i + 1, question: q, response: res, points: scoreVs(q, res) }),
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
  const progress = ((state.current + 1) / state.questions.length) * 100;

  const freqOf = (qq: BeginnerVs3Bet4BetQuestion, a: SelectAction): number =>
    (qq.strategy as unknown as Record<string, number | undefined>)[a] ?? 0;
  const dbgCorrect = (qq: BeginnerVs3Bet4BetQuestion): VsResponse => ({
    kind: 'select',
    actions: SELECT_ACTIONS.filter((a) => freqOf(qq, a) > 0),
  });
  const dbgWrong = (qq: BeginnerVs3Bet4BetQuestion): VsResponse => {
    const zero = SELECT_ACTIONS.find((a) => freqOf(qq, a) <= 0);
    return { kind: 'select', actions: zero ? [zero] : [] };
  };
  const dbgRandom = (): VsResponse => ({
    kind: 'select',
    actions: SELECT_ACTIONS.filter(() => Math.random() < 0.5),
  });

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
        <DebugAnswerBar
          onCorrect={() => debugComplete(dbgCorrect)}
          onWrong={() => debugComplete(dbgWrong)}
          onRandom={() => debugComplete(dbgRandom)}
        />
      </header>

      {animReady && !feedback && (
        <Countdown
          key={`${state.current}-${q.hand}`}
          seconds={TIMER_SECONDS}
          onTimeUp={() => onAnswer({ kind: 'timeout' })}
        />
      )}

      <main style={mainStyle}>
        <div style={scenarioPillStyle}>{scenarioLabelOf(q)}</div>
        <ActionTable
          file={q.nodeFile}
          mePosition={q.hero}
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
          <InstantFeedback points={feedback.points} judgmentFor={vsJudgment} onNext={onProceed}>
            <NodeRangeSection file={q.nodeFile} highlightHand={q.hand} />
          </InstantFeedback>
        ) : (
          <ChoiceButtons<SelectAction>
            key={`choices-${state.current}`}
            availableActions={SELECT_ACTIONS}
            actionLabels={ACTION_LABELS}
            onSubmit={(actions) => onAnswer({ kind: 'select', actions })}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (TrainingPlayBeginnerVsOpen と統一)
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = { minHeight: '100vh', background: THEME.bg, display: 'flex', flexDirection: 'column' };
const headerBarStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.3rem',
  padding: '0.7rem 1rem', background: '#fff', borderBottom: `1px solid ${THEME.border}`,
};
const progressTopStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.85rem' };
const progressLabelStyle: CSSProperties = { fontWeight: 700, color: THEME.textPrimary };
const progressCountStyle: CSSProperties = { color: THEME.textSecondary, fontVariantNumeric: 'tabular-nums' };
const progressBarOuterStyle: CSSProperties = { height: 6, background: THEME.cellEmpty, borderRadius: 3, overflow: 'hidden' };
const progressBarInnerStyle: CSSProperties = { height: '100%', background: THEME.accent, transition: 'width 0.2s' };
const mainStyle: CSSProperties = {
  flex: 1, padding: '1rem', maxWidth: 520, width: '100%', margin: '0 auto',
  display: 'flex', flexDirection: 'column', gap: '1rem',
};
const scenarioPillStyle: CSSProperties = {
  alignSelf: 'flex-start', fontSize: '0.78rem', fontWeight: 700, color: '#993C1D',
  background: '#FAEEDA', border: '1px solid #E5A551', borderRadius: '999px', padding: '0.2rem 0.7rem',
};
const handSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
const handLabelStyle: CSSProperties = {
  fontSize: '0.72rem', color: THEME.textSecondary, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
};
const loadingStyle: CSSProperties = { margin: 'auto', fontSize: '0.95rem', color: THEME.textMuted };
const errorStyle: CSSProperties = {
  margin: 'auto', fontSize: '0.92rem', color: THEME.errorText, background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`, borderRadius: '0.4rem', padding: '1rem 1.2rem',
  display: 'flex', flexDirection: 'column', gap: '0.6rem',
};
const errorBtnStyle: CSSProperties = {
  padding: '0.45rem 1rem', background: THEME.accent, color: '#fff', border: 'none',
  borderRadius: '0.35rem', fontFamily: 'inherit', cursor: 'pointer',
};
