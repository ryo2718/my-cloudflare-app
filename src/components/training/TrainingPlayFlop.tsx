// フロップトレーニング初級の問題画面。
//   - 全20問・2択 (打つ / 打たない)・1問1pt (正解1/不正解0)・時間制限なし。
//   - CB問題 (閾値70%) + ドンク問題 (閾値60%)。
//   - ボードはテーブル中央に FlopBoard でフリップ表示。即時フィードバックは action 分布バー。
// 状態機械・回答・即時FB・離脱警告は共通の useTrainingHarness に集約。

import { useEffect, useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generateFlopBeginnerQuestions,
  scoreFlopAnswer,
  flopScenarioLabel,
  flopShowsVillainCheck,
  type FlopQuestion,
  type FlopResponse,
  type FlopRecord,
} from '../../data/training/flopBeginner';
import { saveFlopRecords } from '../../data/training/flopRecordsStore';
import { DebugAnswerBar } from './DebugAnswerBar';
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { THEME } from '../../styles/theme';
import type { SeatPopup } from '../../data/training/actionHistory';
import { QuitButton } from './QuitButton';
import { InstantFeedback } from './InstantFeedback';
import { ActionTable } from './ActionTable';
import { PokerTable } from './PokerTable';
import { FlopBoard } from './FlopBoard';
import { FlopFeedbackDetail } from './FlopFeedbackDetail';
import { flopJudgment } from './flopFeedbackFormat';
import { useTrainingHarness } from './useTrainingHarness';
import { loadInstantFeedback } from '../../data/userPreferences';

// アニメーションの流れ (修正1):
//   preflop : プリフロップのアクションを順次再生 (ActionTable)。
//   flop    : プリフロップのアクション表示を全消去し、フロップ3枚をフリップ登場 (PokerTable + FlopBoard)。
//   check   : (CB問題でヒーローが IP のときだけ) OOP の check 表示を出す。
//   question: ヒーローの手番。問題文 + 選択ボタンを提示。
type FlopPhase = 'preflop' | 'flop' | 'check' | 'question';
const FLOP_SETTLE_MS = 400; // フロップのフリップが出そろうまで待つ
const CHECK_TO_TURN_MS = 200; // OOP check → ヒーロー手番

export interface TrainingPlayFlopProps {
  level: TrainingLevel;
}

export function TrainingPlayFlop({ level }: TrainingPlayFlopProps) {
  const [instant] = useState<boolean>(loadInstantFeedback);

  const finish = (records: FlopRecord[]) => {
    // 振り返り (答え合わせ) 用に各問の記録を保存してから結果画面へ。
    saveFlopRecords(level.key, records);
    const correctCount = records.filter((r) => r.isCorrect).length;
    const params = new URLSearchParams({
      score: String(correctCount),
      total: String(records.length),
    });
    navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
  };

  const { state, feedback, onAnswer, onProceed, debugComplete } = useTrainingHarness<
    FlopQuestion,
    FlopResponse,
    FlopRecord
  >({
    load: () => generateFlopBeginnerQuestions(),
    reloadKey: level.key,
    instant,
    scorePoints: (q, res) => scoreFlopAnswer(q, res.choice).points,
    buildRecord: (q, res, i) => ({
      ...q,
      recordId: i + 1,
      choice: res.choice,
      isCorrect: scoreFlopAnswer(q, res.choice).correct,
    }),
    finish,
  });

  // アニメーションの流れ (修正1)。問題が切り替わるたびに preflop からやり直す
  // (= prop 変化で状態リセットする React 公式パターン: レンダー中に調整)。
  const currentIdx = state.kind === 'ready' ? state.current : -1;
  const currentQ = state.kind === 'ready' ? state.questions[state.current] : null;
  const needsCheck = currentQ ? flopShowsVillainCheck(currentQ) : false;
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
  const verb = q.type === 'cb' ? 'CB' : 'ドンク';
  const scenarioLabel = flopScenarioLabel(q); // 修正3: 「{srp|3bp} {ヒーロー} vs {相手}」

  // デバッグ (admin 専用): 全問を一括解答 (正解 / 不正解 / ランダム)。
  const dbgCorrect = (qq: FlopQuestion): FlopResponse => ({ choice: qq.correct });
  const dbgWrong = (qq: FlopQuestion): FlopResponse => ({ choice: qq.correct === 'bet' ? 'check' : 'bet' });
  const dbgRandom = (): FlopResponse => ({ choice: Math.random() < 0.5 ? 'bet' : 'check' });

  // フロップ以降のテーブルに残すアクション表示。プリフロップのアクションは全消去し、
  // CB問題 (ヒーロー IP) のときだけ OOP の check を表示する。それ以外は空 (席とボードのみ)。
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
        <div style={scenarioPillStyle}>{scenarioLabel}</div>

        {/* 修正1: preflop はアクションを順次再生。完了後はプリフロップ表示を全消去し、
            PokerTable + FlopBoard でフロップを出す (CB問題は OOP check を経てヒーロー手番)。 */}
        {phase === 'preflop' ? (
          <ActionTable
            mePosition={q.hero}
            items={q.preflopActions}
            animate
            wide
            instantLeadingFolds
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

        {phase === 'question' && (
          <>
            {feedback ? (
              // 修正2: 初級は2値 (1pt→○ / 0pt→×)。△ は使わない (他モードは prop 未指定で従来どおり)。
              <InstantFeedback
                points={feedback.points}
                judgmentFor={flopJudgment}
                onNext={onProceed}
              >
                <FlopFeedbackDetail q={q} />
              </InstantFeedback>
            ) : (
              <>
                <p style={promptStyle}>このフロップ、{verb}を打つ?</p>
                <section style={actionRowStyle}>
                  <button type="button" onClick={() => onAnswer({ choice: 'bet' })} style={betBtnStyle}>
                    {verb}打つ
                  </button>
                  <button type="button" onClick={() => onAnswer({ choice: 'check' })} style={checkBtnStyle}>
                    {verb}打たない
                  </button>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
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
// 修正4: プリフロップ中級のシナリオピル配色 (オレンジ系) に流用統一。
const scenarioPillStyle: CSSProperties = {
  alignSelf: 'flex-start', fontSize: '0.78rem', fontWeight: 700, color: '#993C1D',
  background: '#FAEEDA', border: '1px solid #E5A551', borderRadius: '999px', padding: '0.2rem 0.7rem',
};
const promptStyle: CSSProperties = { margin: 0, fontSize: '1rem', fontWeight: 700, color: THEME.textPrimary, textAlign: 'center' };
const actionRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginTop: 'auto' };
const betBtnStyle: CSSProperties = {
  padding: '0.85rem 1rem', background: '#D8443C', color: '#fff', border: 'none',
  borderRadius: '0.45rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const checkBtnStyle: CSSProperties = {
  padding: '0.85rem 1rem', background: '#fff', color: THEME.textPrimary, border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.45rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
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
