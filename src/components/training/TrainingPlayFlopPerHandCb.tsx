// フロップトレーニング「中級CB(個別ハンド)」の問題画面。
//   - ボード + 自分のハンド を提示し、CBサイズを複数選択。1問1pt (満点相当のみ加点)。
//   - 解答後にハンドレンジgrid (HandRangeMatrix) を表示 (プリフロップと同じ)。

import { useState, type CSSProperties } from 'react';
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
import { saveFlopPhRecords, clearFlopPhRecords } from '../../data/training/flopPerHandRecordsStore';
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { THEME } from '../../styles/theme';
import type { Rank, Suit } from '../../types/card';
import { QuitButton } from './QuitButton';
import { InstantFeedback } from './InstantFeedback';
import { FlopBoard } from './FlopBoard';
import { CardSet } from '../CardSet';
import { ChoiceButtons } from './ChoiceButtons';
import { DebugAnswerBar } from './DebugAnswerBar';
import { HandRangeMatrix } from './HandRangeMatrix';
import { FLOP_CB_ORDER, flopCbLabels, flopCbColor } from './flopCbChoiceStyle';
import { flopJudgment } from './flopFeedbackFormat';
import { useTrainingHarness } from './useTrainingHarness';
import { loadInstantFeedback } from '../../data/userPreferences';

export interface TrainingPlayFlopPerHandCbProps {
  level: TrainingLevel;
}

export function TrainingPlayFlopPerHandCb({ level }: TrainingPlayFlopPerHandCbProps) {
  const [instant] = useState<boolean>(loadInstantFeedback);

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

  // デバッグ (admin): 正解=主要(>=5%)選択 / 不正解=最小頻度 / ランダム。
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

        <div style={boardWrapStyle}>
          <FlopBoard key={state.current} cards={q.board} pot={q.scenario} />
        </div>

        <section style={handSectionStyle}>
          <span style={handLabelStyle}>あなたのハンド ({q.hand})</span>
          <CardSet
            cards={q.heroCards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
            size="lg"
            gap={6}
          />
        </section>

        {feedback ? (
          <InstantFeedback points={feedback.points} judgmentFor={flopJudgment} onNext={onProceed}>
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
            onSubmit={(selections) => onAnswer({ selections: [...selections] })}
          />
        )}
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
const boardWrapStyle: CSSProperties = { display: 'flex', justifyContent: 'center', padding: '0.5rem 0' };
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
