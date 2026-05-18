// /training/review/play: 復習プレイ画面 (中級専用)。
//
// URL params:
//   ?level=intermediate (必須、現状中級のみ)
//   ?limit=N (10/20/50/100、全体復習)
//   ?problem_id=N (1 問だけ復習)
//
// 通常の中級プレイ画面 (TrainingPlayIntermediate) と挙動はほぼ同じ:
//   - PokerTable + ハンド + IntermediateChoices + 20s タイマー
//   - 採点ロジック (scoreAnswer) も同じ
//
// 違い:
//   - 出題ソース = missed_problems API
//   - 完了時 navigate /training/preflop-intermediate/result?mode=review
//   - missed_problems への INSERT はしない (復習は DB に影響なし)
//   - records は別 levelKey (preflop_intermediate__review) に保存して通常記録と衝突回避

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  scoreAnswer,
  scoreTimeout,
  type Action,
  type IntermediateQuestion,
} from '../../data/training/preflopIntermediate';
import { recordsToQuestions } from '../../data/training/reviewMode';
import {
  clearIntermediateRecords,
  saveIntermediateRecords,
  type IntermediateRecord,
} from '../../data/training/recordsStore';
import {
  apiGetMissedProblems,
  type MissedProblemRow,
} from '../../api/missedProblems';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import { PokerTable } from './PokerTable';
import { IntermediateChoices } from './IntermediateChoices';
import { intermediateScenarioLabel } from './intermediateScenarioLabel';
import { useAuth } from '../../hooks/useAuth';
import type { Suit, Rank } from '../../types/card';

const TIMER_SECONDS = 20;
/** review 専用の records 保存キー (通常記録 'preflop_intermediate' と衝突しない)。 */
export const REVIEW_LEVEL_KEY = 'preflop_intermediate__review';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      questions: IntermediateQuestion[];
      current: number;
      finalSum: number;
      records: IntermediateRecord[];
    };

interface UrlParams {
  level: 'intermediate';
  limit: number;
  problemId: number | null;
}

function parseUrlParams(): UrlParams {
  if (typeof window === 'undefined') {
    return { level: 'intermediate', limit: 10, problemId: null };
  }
  const sp = new URLSearchParams(window.location.search);
  const limitRaw = parseInt(sp.get('limit') ?? '10', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 10;
  const pidRaw = sp.get('problem_id');
  const pid = pidRaw ? parseInt(pidRaw, 10) : NaN;
  return {
    level: 'intermediate',
    limit,
    problemId: Number.isFinite(pid) ? pid : null,
  };
}

export function TrainingReviewPlay() {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const advancingRef = useRef(false);

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
    const { limit, problemId } = parseUrlParams();
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    clearIntermediateRecords(REVIEW_LEVEL_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    (async () => {
      try {
        let rows: MissedProblemRow[];
        if (problemId !== null) {
          // 1 問だけ復習: 全件取得 → 該当 id を抽出 (簡易、include_removed=true で削除済みも含む)
          const all = await apiGetMissedProblems(sid, {
            level: 'intermediate',
            limit: 100,
            includeRemoved: true,
          });
          rows = all.filter((r) => r.id === problemId);
        } else {
          rows = await apiGetMissedProblems(sid, { level: 'intermediate', limit });
        }
        if (cancelled) return;
        const questions = recordsToQuestions(rows);
        if (questions.length === 0) {
          setState({ kind: 'empty' });
          return;
        }
        setState({ kind: 'ready', questions, current: 0, finalSum: 0, records: [] });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.sessionId]);

  const advance = (
    selections: ReadonlyArray<Action>,
    timedOut: boolean,
    prev: LoadState,
  ) => {
    if (prev.kind !== 'ready') return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const q = prev.questions[prev.current];
    const breakdown = timedOut
      ? scoreTimeout(q.strategy)
      : scoreAnswer(q.strategy, selections);
    const newRecord: IntermediateRecord = {
      ...q,
      id: prev.current + 1,
      selections: timedOut ? [] : selections,
      timedOut,
      rawScore: breakdown.rawScore,
      finalScore: breakdown.finalScore,
      theoreticalMax: breakdown.theoreticalMax,
      strategySnapshot: q.strategy,
    };
    const newRecords = [...prev.records, newRecord];
    const newFinalSum = prev.finalSum + breakdown.finalScore;
    const next = prev.current + 1;

    if (next >= prev.questions.length) {
      saveIntermediateRecords(REVIEW_LEVEL_KEY, newRecords);
      const params = new URLSearchParams({
        score: String(newFinalSum),
        total: String(prev.questions.length * 2),
        mode: 'review',
      });
      navigate(`/training/preflop-intermediate/result?${params.toString()}`);
      return;
    }
    setState({
      kind: 'ready',
      questions: prev.questions,
      current: next,
      finalSum: newFinalSum,
      records: newRecords,
    });
    Promise.resolve().then(() => {
      advancingRef.current = false;
    });
  };

  if (state.kind === 'loading') {
    return (
      <div style={pageStyle}>
        <div style={infoStyle}>復習問題を読み込み中…</div>
      </div>
    );
  }
  if (state.kind === 'empty') {
    return (
      <div style={pageStyle}>
        <div style={infoColStyle}>
          <p>復習対象の問題がありません。</p>
          <button type="button" onClick={() => navigate('/quiz')} style={btnStyle}>
            トレーニングに戻る
          </button>
        </div>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div style={pageStyle}>
        <div style={errorBoxStyle}>
          取得失敗: {state.message}
          <button type="button" onClick={() => navigate('/quiz')} style={btnStyle}>
            トレーニングに戻る
          </button>
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
          <span style={progressLabelStyle}>復習</span>
          <span style={progressCountStyle}>
            {state.current + 1} / {state.questions.length}
          </span>
        </div>
        <div style={progressBarOuterStyle} aria-hidden>
          <div style={{ ...progressBarInnerStyle, width: `${progress}%` }} />
        </div>
      </header>

      <Countdown
        key={`${state.current}-${q.hand}`}
        seconds={TIMER_SECONDS}
        onTimeUp={() => advance([], true, state)}
      />

      <main style={mainStyle}>
        <div style={scenarioPillStyle}>{intermediateScenarioLabel(q)}</div>
        <PokerTable
          mePosition={q.myPosition}
          opener={q.scenarioType === 'risky_open' ? null : q.opener}
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

        <IntermediateChoices
          key={`choices-${state.current}`}
          onSubmit={(selections) => advance(selections, false, state)}
        />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Countdown (TrainingPlayIntermediate と同じ実装、最小複製)
// ---------------------------------------------------------------------------

function Countdown({
  seconds,
  onTimeUp,
}: {
  seconds: number;
  onTimeUp: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(seconds);
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const r = Math.max(0, seconds - elapsed);
      setRemaining(r);
      if (r <= 0) {
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
    >
      残り {remaining}s
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
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
const infoStyle: CSSProperties = {
  margin: 'auto',
  fontSize: '0.95rem',
  color: THEME.textMuted,
};
const infoColStyle: CSSProperties = {
  margin: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.7rem',
  color: THEME.textSecondary,
};
const errorBoxStyle: CSSProperties = {
  margin: 'auto',
  padding: '1rem 1.2rem',
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  color: THEME.errorText,
  borderRadius: '0.4rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
};
const btnStyle: CSSProperties = {
  padding: '0.5rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.35rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
