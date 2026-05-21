// 中級ポジション別トレーニング (EP / LP / Blind) の問題画面。
// 用語定義は src/data/training/GLOSSARY.md を参照。
//
// フロー:
//   1. マウント時に generatePositionalQuestions(mode) で生成 (EP/LP=20問, Blind=30問)
//   2. 各問: PokerTable + ハンド + (スライダー or 複数選択)
//   3. 20 秒タイマー、時間切れ/飛ばし/回答で素点 (-1/0/1/2) を加算
//   4. 全問完了で合計を ÷2 (floor, 下限0) → /result へ (mode=intermediate で集計表示)

import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import { PokerTable } from './PokerTable';
import { SliderChoice } from './SliderChoice';
import { PositionalChoices } from './PositionalChoices';
import { QuitButton } from './QuitButton';
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

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; questions: PositionalQuestion[]; current: number; points: number[] };

export function TrainingPlayPositional({ level }: TrainingPlayPositionalProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const advancingRef = useRef(false);
  const mode = modeFromLevelKey(level.key);

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
    if (!mode) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    generatePositionalQuestions(mode)
      .then((questions) => {
        if (cancelled) return;
        if (questions.length === 0) {
          setState({ kind: 'error', message: '出題データの読み込みに失敗しました' });
          return;
        }
        setState({ kind: 'ready', questions, current: 0, points: [] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [level.key, mode]);

  const advance = (res: PositionalResponse, prev: LoadState) => {
    if (prev.kind !== 'ready') return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const q = prev.questions[prev.current];
    const pts = scorePositionalPoints(q, res);
    const newPoints = [...prev.points, pts];
    const next = prev.current + 1;

    if (next >= prev.questions.length && mode) {
      const score = totalPositionalScore(newPoints);
      const params = new URLSearchParams({
        score: String(score),
        total: String(maxScoreForMode(mode)),
        mode: 'intermediate',
      });
      navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
      return;
    }
    setState({ kind: 'ready', questions: prev.questions, current: next, points: newPoints });
    Promise.resolve().then(() => {
      advancingRef.current = false;
    });
  };

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

      <Countdown
        key={`${state.current}-${q.hand}`}
        seconds={TIMER_SECONDS}
        onTimeUp={() => advance({ kind: 'timeout' }, state)}
      />

      <main style={mainStyle}>
        <div style={scenarioPillStyle}>{q.label}</div>
        <PokerTable
          mePosition={q.myPosition}
          opener={q.opener}
          foldedSet={q.foldedBefore}
          chipExtras={q.chipExtras}
        />

        <section style={handSectionStyle}>
          <span style={handLabelStyle}>ハンド</span>
          <CardSet
            cards={q.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
            size="lg"
            gap={6}
          />
        </section>

        {q.format === 'slider' ? (
          <SliderChoice
            key={`slider-${state.current}`}
            actionLabel={q.actionLabels.raise}
            onSubmit={(pct) => advance({ kind: 'slider', pct }, state)}
            onSkip={() => advance({ kind: 'skip' }, state)}
          />
        ) : (
          <PositionalChoices
            key={`select-${state.current}`}
            availableActions={q.availableActions}
            actionLabels={q.actionLabels}
            onSubmit={(selections) => advance({ kind: 'select', selections }, state)}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

function Countdown({ seconds, onTimeUp }: { seconds: number; onTimeUp: () => void }) {
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
const handSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
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
