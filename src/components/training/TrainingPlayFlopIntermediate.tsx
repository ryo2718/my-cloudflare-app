// フロップトレーニング「CB」(レンジベット) の問題画面。CB SRP / CB 3BP4BP5BP 共用。
//   - 全30問・1問2pt・満点60・時間制限なし。全問 CB(サイズ複数選択)。モードは level.key で決定。
//   - テーブル図・カード・アニメは初級 (TrainingPlayFlop) を流用。CB=ChoiceButtons。
//   - 即時フィードバックで GTO サイズ構成 + 「似た頻度のボード」を併せて表示。

import { useEffect, useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generateFlopRbQuestions,
  flopRbModeOf,
  flopRbPrompt,
  scoreFlopRb,
  flopRbScenarioLabel,
  FLOP_RB_MAX_SCORE,
  type FlopRbQuestion,
  type FlopRbResponse,
  type FlopRbRecord,
} from '../../data/training/flopIntermediateCb';
import { flopShowsVillainCheck } from '../../data/training/flopBeginner';
import { saveFlopRbRecords, clearFlopRbRecords } from '../../data/training/flopCbRecordsStore';
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { THEME } from '../../styles/theme';
import type { SeatPopup } from '../../data/training/actionHistory';
import { QuitButton } from './QuitButton';
import { InstantFeedback } from './InstantFeedback';
import { ActionTable } from './ActionTable';
import { PokerTable } from './PokerTable';
import { FlopBoard } from './FlopBoard';
import { ChoiceButtons } from './ChoiceButtons';
import { DebugAnswerBar } from './DebugAnswerBar';
import { FlopCbReviewDetail } from './FlopCbReviewDetail';
import { FlopSimilarBoards } from './FlopSimilarBoards';
import { FLOP_CB_ORDER, flopCbLabels, flopCbColor } from './flopCbChoiceStyle';
import { useTrainingHarness } from './useTrainingHarness';
import { loadInstantFeedback } from '../../data/userPreferences';
import { useAuth } from '../../hooks/useAuth';
import { apiPostMissedProblems, type FlopTrainingType } from '../../api/missedProblems';
import { flopRbMissedInput } from '../../data/training/flopMissedMode';

type FlopPhase = 'preflop' | 'flop' | 'check' | 'question';
const FLOP_SETTLE_MS = 400;
const CHECK_TO_TURN_MS = 200;
/** 1問満点 (これ未満を「間違えた問題」として記録)。 */
const FLOP_RB_PERFECT = 2;

const selOf = (r: FlopRbResponse | null): ReadonlyArray<string> => r?.selections ?? [];

/** 復習(再出題)モード設定。指定時は通常生成・記録の代わりに使う。 */
export interface FlopRbReview {
  /** 再構築済みの出題。 */
  questions: FlopRbQuestion[];
  /** 完了時 (pt 加算・DB 記録なし)。 */
  onFinish: (records: FlopRbRecord[]) => void;
}

export interface TrainingPlayFlopIntermediateProps {
  level: TrainingLevel;
  /** 指定時は復習(間違えた問題の再出題)モード。 */
  review?: FlopRbReview;
}

export function TrainingPlayFlopIntermediate({ level, review }: TrainingPlayFlopIntermediateProps) {
  const auth = useAuth();
  const [instant] = useState<boolean>(loadInstantFeedback);
  const [lastRes, setLastRes] = useState<FlopRbResponse | null>(null);

  const finish = (records: FlopRbRecord[]) => {
    // 復習モード: pt 加算・DB 記録・間違えた問題記録は行わない。
    if (review) {
      review.onFinish(records);
      return;
    }
    saveFlopRbRecords(level.key, records);
    // 満点未満を「間違えた問題」として記録 (ベスト努力・失敗は silent)。
    if (auth.sessionId) {
      const missed = records
        .filter((r) => r.finalScore < FLOP_RB_PERFECT)
        .map((r) => flopRbMissedInput(level.key as FlopTrainingType, r, r.finalScore));
      if (missed.length > 0) {
        void apiPostMissedProblems(auth.sessionId, missed).catch(() => {
          /* silent fallback */
        });
      }
    }
    const finalSum = records.reduce((s, r) => s + r.finalScore, 0);
    const params = new URLSearchParams({ score: String(finalSum), total: String(FLOP_RB_MAX_SCORE) });
    navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
  };

  const { state, feedback, onAnswer, onProceed, debugComplete } = useTrainingHarness<
    FlopRbQuestion,
    FlopRbResponse,
    FlopRbRecord
  >({
    load: review ? () => Promise.resolve(review.questions) : () => generateFlopRbQuestions(flopRbModeOf(level.key)),
    onLoadStart: review ? undefined : () => clearFlopRbRecords(level.key),
    reloadKey: review ? `review:${level.key}` : level.key,
    instant,
    scorePoints: (q, res) => scoreFlopRb(q, res),
    buildRecord: (q, res, i) => ({ ...q, recordId: i + 1, response: res, finalScore: scoreFlopRb(q, res) }),
    finish,
  });

  const handleAnswer = (res: FlopRbResponse) => {
    setLastRes(res);
    onAnswer(res);
  };

  // デバッグ (admin 専用) picker。
  const dbgCorrect = (q: FlopRbQuestion): FlopRbResponse => ({
    kind: 'select',
    selections: q.choices.filter((c) => (q.strat[c] ?? 0) >= 0.05),
  });
  const dbgWrong = (q: FlopRbQuestion): FlopRbResponse => {
    let lo = q.choices[0];
    for (const c of q.choices) if ((q.strat[c] ?? 0) < (q.strat[lo] ?? 0)) lo = c;
    return { kind: 'select', selections: [lo] };
  };
  const dbgRandom = (q: FlopRbQuestion): FlopRbResponse => {
    const picks = q.choices.filter(() => Math.random() < 0.5);
    return { kind: 'select', selections: picks.length ? picks : [q.choices[0]] };
  };

  // アニメの流れ。問題切替で preflop からやり直す。CB(ヒーローIP)のみ villain check を挟む。
  const currentIdx = state.kind === 'ready' ? state.current : -1;
  const currentQ = state.kind === 'ready' ? state.questions[state.current] : null;
  const needsCheck = currentQ
    ? flopShowsVillainCheck({ type: 'cb', hero: currentQ.hero, villain: currentQ.villain })
    : false;
  const [phase, setPhase] = useState<FlopPhase>('preflop');
  const [phaseIdx, setPhaseIdx] = useState(currentIdx);
  if (phaseIdx !== currentIdx) {
    setPhaseIdx(currentIdx);
    setPhase('preflop');
  }
  useEffect(() => {
    if (phase === 'flop') {
      const t = setTimeout(() => setPhase(needsCheck ? 'check' : 'question'), FLOP_SETTLE_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'check') {
      const t = setTimeout(() => setPhase('question'), CHECK_TO_TURN_MS);
      return () => clearTimeout(t);
    }
  }, [phase, needsCheck]);

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
  const scenarioLabel = flopRbScenarioLabel(q);

  const showVillainCheck = needsCheck && (phase === 'check' || phase === 'question');
  const tablePopups: SeatPopup[] = showVillainCheck
    ? [{ position: q.villain, kind: 'call', label: 'check' }]
    : [];

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

      <main style={mainStyle}>
        <div style={scenarioRowStyle}>
          <span style={scenarioPillStyle}>{scenarioLabel}</span>
        </div>

        {phase === 'preflop' ? (
          <ActionTable
            mePosition={q.hero}
            items={q.preflopActions}
            animate
            wide
            instantLeadingFolds
            involvedPositions={[q.hero, q.villain]}
            resetKey={state.current}
            onAnimationDone={() => setPhase('flop')}
          />
        ) : (
          <PokerTable
            mePosition={q.hero}
            wide
            popups={tablePopups}
            involvedPositions={[q.hero, q.villain]}
            centerSlot={<FlopBoard key={state.current} cards={q.board} pot={q.pot} />}
          />
        )}

        {phase === 'question' &&
          (feedback ? (
            <InstantFeedback points={feedback.points} onNext={onProceed}>
              <FlopCbReviewDetail choices={q.choices} strat={q.strat} selections={selOf(lastRes)} />
              <FlopSimilarBoards similar={q.similar} />
            </InstantFeedback>
          ) : (
            <ChoiceButtons
              key={`cb-${state.current}`}
              availableActions={q.choices}
              actionLabels={flopCbLabels(q.choices)}
              order={FLOP_CB_ORDER}
              resolveColor={flopCbColor}
              showColorChip
              prompt={flopRbPrompt(q.kind)}
              onSubmit={(selections) => handleAnswer({ kind: 'select', selections: [...selections] })}
            />
          ))}
      </main>
    </div>
  );
}

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
const scenarioRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem' };
const scenarioPillStyle: CSSProperties = {
  fontSize: '0.78rem', fontWeight: 700, color: '#993C1D',
  background: '#FAEEDA', border: '1px solid #E5A551', borderRadius: '999px', padding: '0.2rem 0.7rem',
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
