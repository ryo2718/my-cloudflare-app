// フロップトレーニング初級の問題画面。
//   - 全20問・2択 (打つ / 打たない)・1問1pt (正解1/不正解0)・時間制限なし。
//   - CB問題 (閾値70%) + ドンク問題 (閾値60%)。
//   - ボードは CardSet (PlayingCard) で表示。即時フィードバックは action 分布バー。
// 状態機械・回答・即時FB・離脱警告は共通の useTrainingHarness に集約。

import { useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generateFlopBeginnerQuestions,
  scoreFlopAnswer,
  type FlopQuestion,
  type FlopResponse,
  type FlopChoice,
} from '../../data/training/flopBeginner';
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import { QuitButton } from './QuitButton';
import { InstantFeedback } from './InstantFeedback';
import { useTrainingHarness } from './useTrainingHarness';
import { loadInstantFeedback } from '../../data/userPreferences';

export interface TrainingPlayFlopProps {
  level: TrainingLevel;
}

interface FlopRecord extends FlopQuestion {
  recordId: number;
  choice: FlopChoice | null;
  isCorrect: boolean;
}

/** action_code → 表示ラベル。X=チェック、それ以外=ベット (サイズ付き)。 */
function actionLabel(code: string): string {
  if (code === 'X') return 'チェック';
  if (code === 'RAI') return 'オールイン';
  if (code.startsWith('R')) return `ベット ${code.slice(1)}`;
  return code;
}

export function TrainingPlayFlop({ level }: TrainingPlayFlopProps) {
  const [instant] = useState<boolean>(loadInstantFeedback);

  const finish = (records: FlopRecord[]) => {
    const correctCount = records.filter((r) => r.isCorrect).length;
    const params = new URLSearchParams({
      score: String(correctCount),
      total: String(records.length),
    });
    navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
  };

  const { state, feedback, onAnswer, onProceed } = useTrainingHarness<
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
  const potLabel = q.pot === 'SRP' ? 'シングルレイズドポット' : '3ベットポット';

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

      <main style={mainStyle}>
        <div style={scenarioPillStyle}>{potLabel} ・ {q.hero}</div>

        <section style={boardSectionStyle}>
          <span style={boardLabelStyle}>フロップ</span>
          <CardSet cards={q.board} size="lg" gap={6} />
        </section>

        {feedback ? (
          <InstantFeedback points={feedback.points} onNext={onProceed}>
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
      </main>
    </div>
  );
}

/** 即時フィードバック: そのボードの action 頻度分布バー + 正解。 */
function FlopFeedbackDetail({ q }: { q: FlopQuestion }) {
  const verb = q.type === 'cb' ? 'CB' : 'ドンク';
  const rate = Math.round(q.rate * 100);
  const correctText = q.correct === 'bet' ? `${verb}打つ` : `${verb}打たない`;
  return (
    <div style={fbStyle}>
      <div style={fbHeadStyle}>
        {verb}頻度 {rate}% → 正解: <span style={fbCorrectStyle}>{correctText}</span>
      </div>
      <ul style={fbListStyle}>
        {q.actions.map((a) => {
          const pct = Math.round(a.freq * 100);
          if (pct <= 0) return null;
          const isCheck = a.code === 'X';
          return (
            <li key={a.code} style={fbRowStyle}>
              <span style={fbActionStyle}>{actionLabel(a.code)}</span>
              <span style={fbBarTrackStyle}>
                <span
                  style={{ ...fbBarFillStyle, width: `${pct}%`, background: isCheck ? '#2F7BC4' : '#D8443C' }}
                />
              </span>
              <span style={fbPctStyle}>{pct}%</span>
            </li>
          );
        })}
      </ul>
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
const scenarioPillStyle: CSSProperties = {
  alignSelf: 'flex-start', fontSize: '0.82rem', fontWeight: 700, color: '#26215C',
  background: '#EEEDFE', border: '1px solid #C9C4F0', borderRadius: '999px', padding: '0.25rem 0.7rem',
};
const boardSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
const boardLabelStyle: CSSProperties = {
  fontSize: '0.72rem', color: THEME.textSecondary, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
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
const fbStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const fbHeadStyle: CSSProperties = { fontSize: '0.9rem', fontWeight: 700, color: THEME.textPrimary };
const fbCorrectStyle: CSSProperties = { color: '#1F4D11' };
const fbListStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' };
const fbRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '5.5rem 1fr 2.5rem', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' };
const fbActionStyle: CSSProperties = { color: THEME.textSecondary };
const fbBarTrackStyle: CSSProperties = { height: 10, background: THEME.cellEmpty, borderRadius: 5, overflow: 'hidden' };
const fbBarFillStyle: CSSProperties = { display: 'block', height: '100%' };
const fbPctStyle: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: THEME.textPrimary, fontWeight: 600 };
