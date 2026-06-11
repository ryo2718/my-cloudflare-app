// プリフロップ初級「オープン」モードの問題画面 (スライダー)。
//   各ポジションのオープン頻度 (レイズ%) をスライダーで回答。優しい採点 (±20% で正解, 減点なし)。
//   1問0.5pt × 20問 = 10pt。best_score は正解数 (0-20) で保存し pt は points=0.5 で換算。
//   アニメ (ActionTable)・即時FB・タイマー(50s)・離脱警告は共通の useTrainingHarness/部品を流用。
//   ※ 間違えた問題の記録 (apiPostMissedProblems) は本フェーズでは入れない (フェーズ6)。

import { useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generateBeginnerOpenQuestions,
  type BeginnerOpenQuestion,
} from '../../data/training/preflopBeginnerOpen';
import { scoreGentleSlider } from '../../data/training/preflopBeginnerExt';
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { THEME } from '../../styles/theme';
import { ActionTable } from './ActionTable';
import { CardSet } from '../CardSet';
import { SliderChoice } from './SliderChoice';
import { InstantFeedback } from './InstantFeedback';
import { NodeRangeSection } from './NodeRangeSection';
import { Countdown } from './Countdown';
import { QuitButton } from './QuitButton';
import { DebugAnswerBar } from './DebugAnswerBar';
import { useTrainingHarness } from './useTrainingHarness';
import { loadInstantFeedback } from '../../data/userPreferences';
import type { StrategySymbol } from '../../utils/strategySymbol';
import type { Suit, Rank } from '../../types/card';

const TIMER_SECONDS = 50;

/** 回答 (スライダー / 時間切れ / 飛ばし)。 */
type OpenResponse = { kind: 'slider'; pct: number } | { kind: 'timeout' } | { kind: 'skip' };
interface OpenRecord {
  id: number;
  question: BeginnerOpenQuestion;
  response: OpenResponse;
  /** 1問の獲得 pt (0.5 = 正解 / 0 = 不正解)。 */
  points: number;
}

/** ±20% 以内で正解なら 0.5pt、それ以外 0pt (減点なし)。 */
function scoreOpen(q: BeginnerOpenQuestion, res: OpenResponse): number {
  if (res.kind !== 'slider') return 0;
  return scoreGentleSlider(res.pct, q.raisePct);
}

/** 0.5pt(正解)→ ○ / 0pt(不正解)→ ✕。 */
function openJudgment(points: number): StrategySymbol {
  return points > 0 ? '○' : '✕';
}

export interface TrainingPlayBeginnerOpenProps {
  level: TrainingLevel;
}

export function TrainingPlayBeginnerOpen({ level }: TrainingPlayBeginnerOpenProps) {
  const [instant] = useState<boolean>(loadInstantFeedback);

  const finish = (records: OpenRecord[]) => {
    // best_score = 正解数 (0-20)。pt は catalog points=0.5 で換算 (満点 10pt)。
    const correctCount = records.filter((r) => r.points > 0).length;
    const params = new URLSearchParams({
      score: String(correctCount),
      total: String(records.length),
    });
    navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
  };

  const { state, animReady, setAnimReady, feedback, onAnswer, onProceed, debugComplete } = useTrainingHarness<
    BeginnerOpenQuestion,
    OpenResponse,
    OpenRecord
  >({
    load: () => generateBeginnerOpenQuestions(),
    reloadKey: level.key,
    instant,
    scorePoints: scoreOpen,
    buildRecord: (q, res, i) => ({ id: i + 1, question: q, response: res, points: scoreOpen(q, res) }),
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

  // デバッグ (admin 専用) picker。
  const dbgCorrect = (qq: BeginnerOpenQuestion): OpenResponse => ({ kind: 'slider', pct: qq.raisePct });
  const dbgWrong = (qq: BeginnerOpenQuestion): OpenResponse => ({ kind: 'slider', pct: qq.raisePct >= 50 ? 0 : 100 });
  const dbgRandom = (): OpenResponse => ({ kind: 'slider', pct: Math.floor(Math.random() * 11) * 10 });

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
        <div style={scenarioPillStyle}>{q.position} オープン</div>
        <ActionTable
          file={q.nodeFile}
          mePosition={q.position}
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
          <InstantFeedback points={feedback.points} judgmentFor={openJudgment} onNext={onProceed}>
            <div style={sliderPctStyle}>
              正解 {q.raisePct}%
              {feedback.res.kind === 'slider' ? ` / あなた ${feedback.res.pct}%` : ''}
            </div>
            <NodeRangeSection file={q.nodeFile} highlightHand={q.hand} />
          </InstantFeedback>
        ) : (
          <SliderChoice
            key={`slider-${state.current}`}
            actionLabel="レイズ"
            onSubmit={(pct) => onAnswer({ kind: 'slider', pct })}
            onSkip={() => onAnswer({ kind: 'skip' })}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (TrainingPlayPositional / TrainingPlayIntermediate と統一)
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
const sliderPctStyle: CSSProperties = { textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, color: THEME.textPrimary, fontVariantNumeric: 'tabular-nums' };
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
