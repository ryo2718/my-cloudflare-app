// フロップトレーニング「中級CB(個別ハンド)」の問題画面。
//   - プリフロップ→フロップのアニメ (中級レンジから流用) → ボード + 自分のハンド を提示し、
//     CBサイズを複数選択。1問1pt (満点相当のみ加点)。
//   - 解答後: 出題ハンドのサイズ混合戦略 (FlopCbReviewDetail) + ハンドレンジgrid を表示。

import { useEffect, useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generateFlopPhQuestions,
  scoreFlopPh,
  flopPhScenarioLabel,
  FLOP_PH_MAX_SCORE,
  type FlopPhQuestion,
  type FlopPhResponse,
  type FlopPhRecord,
} from '../../data/training/flopPerHandCb';
import { flopShowsVillainCheck } from '../../data/training/flopBeginner';
import { saveFlopPhRecords, clearFlopPhRecords } from '../../data/training/flopPerHandRecordsStore';
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { THEME } from '../../styles/theme';
import type { SeatPopup } from '../../data/training/actionHistory';
import type { Rank, Suit } from '../../types/card';
import { QuitButton } from './QuitButton';
import { InstantFeedback } from './InstantFeedback';
import { ActionTable } from './ActionTable';
import { PokerTable } from './PokerTable';
import { FlopBoard } from './FlopBoard';
import { CardSet } from '../CardSet';
import { ChoiceButtons } from './ChoiceButtons';
import { DebugAnswerBar } from './DebugAnswerBar';
import { HandRangeMatrix } from './HandRangeMatrix';
import { FlopCbReviewDetail } from './FlopCbReviewDetail';
import { FLOP_CB_ORDER, flopCbLabels, flopCbColor } from './flopCbChoiceStyle';
import { flopJudgment } from './flopFeedbackFormat';
import { useTrainingHarness } from './useTrainingHarness';
import { loadInstantFeedback } from '../../data/userPreferences';

type FlopPhase = 'preflop' | 'flop' | 'check' | 'question';
const FLOP_SETTLE_MS = 400;
const CHECK_TO_TURN_MS = 200;

export interface TrainingPlayFlopPerHandCbProps {
  level: TrainingLevel;
}

export function TrainingPlayFlopPerHandCb({ level }: TrainingPlayFlopPerHandCbProps) {
  const [instant] = useState<boolean>(loadInstantFeedback);
  const [lastSel, setLastSel] = useState<ReadonlyArray<string>>([]);

  const finish = (records: FlopPhRecord[]) => {
    saveFlopPhRecords(level.key, records);
    const score = records.reduce((s, r) => s + r.points, 0);
    const params = new URLSearchParams({ score: String(score), total: String(FLOP_PH_MAX_SCORE) });
    navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
  };

  const { state, feedback, onAnswer, onProceed, debugComplete } = useTrainingHarness<
    FlopPhQuestion,
    FlopPhResponse,
    FlopPhRecord
  >({
    load: () => generateFlopPhQuestions(),
    onLoadStart: () => clearFlopPhRecords(level.key),
    reloadKey: level.key,
    instant,
    scorePoints: (q, res) => scoreFlopPh(q.strat, res).points,
    buildRecord: (q, res, i) => {
      const sc = scoreFlopPh(q.strat, res);
      return { ...q, recordId: i + 1, selections: res.selections, correct: sc.correct, points: sc.points };
    },
    finish,
  });

  const handleAnswer = (res: FlopPhResponse) => {
    setLastSel(res.selections);
    onAnswer(res);
  };

  // デバッグ (admin)。
  const dbgCorrect = (q: FlopPhQuestion): FlopPhResponse => ({
    selections: q.choices.filter((c) => (q.strat[c] ?? 0) >= 0.05),
  });
  const dbgWrong = (q: FlopPhQuestion): FlopPhResponse => {
    let lo = q.choices[0];
    for (const c of q.choices) if ((q.strat[c] ?? 0) < (q.strat[lo] ?? 0)) lo = c;
    return { selections: [lo] };
  };
  const dbgRandom = (q: FlopPhQuestion): FlopPhResponse => {
    const picks = q.choices.filter(() => Math.random() < 0.5);
    return { selections: picks.length ? picks : [q.choices[0]] };
  };

  // アニメの流れ (中級レンジから流用)。問題切替で preflop からやり直す。
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
        <div style={scenarioPillStyle}>{flopPhScenarioLabel(q)}</div>

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
            centerSlot={<FlopBoard key={state.current} cards={q.board} pot={q.scenario} />}
          />
        )}

        <section style={handSectionStyle}>
          <span style={handLabelStyle}>あなたのハンド ({q.hand})</span>
          <CardSet
            cards={q.heroCards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
            size="lg"
            gap={6}
          />
        </section>

        {phase === 'question' &&
          (feedback ? (
            <InstantFeedback points={feedback.points} judgmentFor={flopJudgment} onNext={onProceed}>
              <FlopCbReviewDetail choices={q.choices} strat={q.strat} selections={lastSel} />
              <HandRangeMatrix
                hands={q.rangeHands}
                highlightHand={q.hand}
                caption={`${flopPhScenarioLabel(q)} のCBレンジ`}
              />
            </InstantFeedback>
          ) : (
            <ChoiceButtons
              key={`ph-${state.current}`}
              availableActions={q.choices}
              actionLabels={flopCbLabels(q.choices)}
              order={FLOP_CB_ORDER}
              resolveColor={flopCbColor}
              showColorChip
              prompt={`${q.hand} でCBをどう打つ?(複数選択可)`}
              onSubmit={(selections) => handleAnswer({ selections: [...selections] })}
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
const scenarioPillStyle: CSSProperties = {
  alignSelf: 'flex-start', fontSize: '0.78rem', fontWeight: 700, color: '#993C1D',
  background: '#FAEEDA', border: '1px solid #E5A551', borderRadius: '999px', padding: '0.2rem 0.7rem',
};
const handSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
const handLabelStyle: CSSProperties = { fontSize: '0.8rem', fontWeight: 700, color: THEME.textSecondary };
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
