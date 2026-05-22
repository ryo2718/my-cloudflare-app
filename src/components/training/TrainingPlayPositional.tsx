// 中級ポジション別トレーニング (EP / LP / Blind) の問題画面。
// 用語定義は src/data/training/GLOSSARY.md を参照。
//
// フロー:
//   1. マウント時に generatePositionalQuestions(mode) で生成 (EP/LP=20問, Blind=30問)
//   2. 各問: PokerTable + ハンド + (スライダー or 複数選択)
//   3. 20 秒タイマー、時間切れ/飛ばし/回答で素点 (-1/0/1/2) を加算
//   4. 全問完了で合計を ÷2 (floor, 下限0) → /result へ (mode=intermediate で集計表示)
//
// 状態機械・回答処理・即時フィードバック・タイマー・離脱警告は共通の useTrainingHarness に集約。

import { useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generatePositionalQuestions,
  scorePositionalPoints,
  totalPositionalScore,
  maxScoreForMode,
  type PositionalMode,
  type PositionalQuestion,
  type PositionalResponse,
} from '../../data/training/preflopIntermediatePositional';
import { positionalPillStyle } from './positionalPill';
import { ActionTable } from './ActionTable';
import { encodeMissedInput } from '../../data/training/positionalReview';
import {
  savePositionalRecords,
  clearPositionalRecords,
  type PositionalRecord,
} from '../../data/training/positionalRecordsStore';
import { apiPostMissedProblems } from '../../api/missedProblems';
import { useAuth } from '../../hooks/useAuth';
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import { SliderChoice } from './SliderChoice';
import { ChoiceButtons } from './ChoiceButtons';
import { QuitButton } from './QuitButton';
import { InstantFeedback } from './InstantFeedback';
import { NodeRangeSection } from './NodeRangeSection';
import { Countdown } from './Countdown';
import { useTrainingHarness } from './useTrainingHarness';
import { positionalViewInfo } from './trainingViewInfo';
import { loadInstantFeedback } from '../../data/userPreferences';
import type { Suit, Rank } from '../../types/card';

const TIMER_SECONDS = 20;

/** level.key → PositionalMode。 */
function modeFromLevelKey(key: string): PositionalMode | null {
  if (key === 'preflop_intermediate_ep') return 'ep';
  if (key === 'preflop_intermediate_lp') return 'lp';
  if (key === 'preflop_intermediate_blind') return 'blind';
  return null;
}

export interface TrainingPlayPositionalProps {
  level: TrainingLevel;
}

export function TrainingPlayPositional({ level }: TrainingPlayPositionalProps) {
  const auth = useAuth();
  const mode = modeFromLevelKey(level.key);
  const [instant] = useState<boolean>(loadInstantFeedback);

  const finish = (records: PositionalRecord[]) => {
    if (!mode) return;
    savePositionalRecords(level.key, records);
    // 満点未達 (素点 < 2) を間違えた問題集 (DB) に記録。ベスト努力で実行、失敗は silent。
    if (auth.sessionId) {
      const missed = records
        .filter((r) => r.points < 2)
        .map((r) => encodeMissedInput(r.question, r.response, r.points));
      if (missed.length > 0) {
        void apiPostMissedProblems(auth.sessionId, missed).catch(() => {
          /* silent */
        });
      }
    }
    const score = totalPositionalScore(records.map((r) => r.points));
    const params = new URLSearchParams({
      score: String(score),
      total: String(maxScoreForMode(mode)),
      mode: 'positional',
    });
    navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
  };

  const { state, animReady, setAnimReady, feedback, onAnswer, onProceed } = useTrainingHarness<
    PositionalQuestion,
    PositionalResponse,
    PositionalRecord
  >({
    load: () => (mode ? generatePositionalQuestions(mode) : Promise.resolve([])),
    onLoadStart: () => clearPositionalRecords(level.key),
    reloadKey: level.key,
    instant,
    scorePoints: scorePositionalPoints,
    buildRecord: (q, res, i) => ({ id: i + 1, question: q, response: res, points: scorePositionalPoints(q, res) }),
    finish,
  });

  if (!mode) {
    return (
      <div style={pageStyle}>
        <div style={errorStyle}>
          不明なレベルです: {level.key}
          <div>
            <button type="button" onClick={() => navigate('/quiz')} style={errorBtnStyle}>
              トレーニングに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }
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
  const view = positionalViewInfo(q);
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
          onTimeUp={() => onAnswer({ kind: 'timeout' })}
        />
      )}

      <main style={mainStyle}>
        <div style={positionalPillStyle(q.scenarioKey)}>{q.label}</div>
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
            {feedback.res.kind === 'slider' && (
              <div style={sliderPctStyle}>
                正解 {q.sliderCorrectPct}% / あなた {feedback.res.pct}%
              </div>
            )}
            <NodeRangeSection file={view.nodeFile} highlightHand={view.hand} actionLabels={view.actionLabels} />
          </InstantFeedback>
        ) : q.format === 'slider' ? (
          <SliderChoice
            key={`slider-${state.current}`}
            actionLabel={q.actionLabels[q.sliderAction]}
            onSubmit={(pct) => onAnswer({ kind: 'slider', pct })}
            onSkip={() => onAnswer({ kind: 'skip' })}
          />
        ) : (
          <ChoiceButtons
            key={`select-${state.current}`}
            availableActions={q.availableActions}
            actionLabels={q.actionLabels}
            onSubmit={(selections) => onAnswer({ kind: 'select', selections })}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (TrainingPlayIntermediate と統一)
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = { minHeight: '100vh', background: THEME.bg, display: 'flex', flexDirection: 'column' };
const headerBarStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  padding: '0.7rem 1rem',
  background: '#fff',
  borderBottom: `1px solid ${THEME.border}`,
};
const progressTopStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.85rem' };
const progressLabelStyle: CSSProperties = { fontWeight: 700, color: THEME.textPrimary };
const progressCountStyle: CSSProperties = { color: THEME.textSecondary, fontVariantNumeric: 'tabular-nums' };
const progressBarOuterStyle: CSSProperties = { height: 6, background: THEME.cellEmpty, borderRadius: 3, overflow: 'hidden' };
const progressBarInnerStyle: CSSProperties = { height: '100%', background: THEME.accent, transition: 'width 0.2s' };
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
const sliderPctStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '0.9rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  fontVariantNumeric: 'tabular-nums',
};
const handSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
const handLabelStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textSecondary,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
const loadingStyle: CSSProperties = { margin: 'auto', fontSize: '0.95rem', color: THEME.textMuted };
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
