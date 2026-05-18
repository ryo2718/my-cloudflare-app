// /training/review/play?level=beginner: 初級復習プレイ画面 (Step 3a)。
//
// 動作:
//   - GET /api/account/missed-problems?level=beginner で fetch
//   - recordsToBeginnerQuestions で PreflopQuestion[] に復元
//   - 既存初級 UI と同じ (PokerTable + 2 択 [参加]/[参加しない])
//   - 採点: userAnswer === correct (1 or 0 ベース)
//   - 完了時 navigate /training/preflop-beginner/result?mode=review_beginner

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import type { CorrectAnswer, PreflopQuestion } from '../../data/training/preflopBeginner';
import { recordsToBeginnerQuestions } from '../../data/training/reviewMode';
import {
  clearRecords,
  saveRecords,
  type ProblemRecord,
} from '../../data/training/recordsStore';
import {
  apiGetMissedProblems,
  type MissedProblemRow,
} from '../../api/missedProblems';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import { PokerTable } from './PokerTable';
import { useAuth } from '../../hooks/useAuth';
import type { Rank, Suit } from '../../types/card';

/** 初級復習用の records 保存キー (通常記録 'preflop_beginner' と衝突しない)。 */
export const REVIEW_BEGINNER_LEVEL_KEY = 'preflop_beginner__review';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      questions: PreflopQuestion[];
      current: number;
      correctCount: number;
      records: ProblemRecord[];
    };

interface UrlParams {
  limit: number;
  problemId: number | null;
}

function parseUrlParams(): UrlParams {
  if (typeof window === 'undefined') return { limit: 10, problemId: null };
  const sp = new URLSearchParams(window.location.search);
  const limitRaw = parseInt(sp.get('limit') ?? '10', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 10;
  const pidRaw = sp.get('problem_id');
  const pid = pidRaw ? parseInt(pidRaw, 10) : NaN;
  return { limit, problemId: Number.isFinite(pid) ? pid : null };
}

export function TrainingReviewPlayBeginner() {
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
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    const { limit, problemId } = parseUrlParams();
    let cancelled = false;
    clearRecords(REVIEW_BEGINNER_LEVEL_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    (async () => {
      try {
        let rows: MissedProblemRow[];
        if (problemId !== null) {
          const all = await apiGetMissedProblems(sid, {
            level: 'beginner',
            limit: 100,
            includeRemoved: true,
          });
          rows = all.filter((r) => r.id === problemId);
        } else {
          rows = await apiGetMissedProblems(sid, { level: 'beginner', limit });
        }
        if (cancelled) return;
        const questions = recordsToBeginnerQuestions(rows);
        if (questions.length === 0) {
          setState({ kind: 'empty' });
          return;
        }
        setState({ kind: 'ready', questions, current: 0, correctCount: 0, records: [] });
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

  const advance = (chosen: CorrectAnswer, prev: LoadState) => {
    if (prev.kind !== 'ready') return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const q = prev.questions[prev.current];
    const isCorrect = q.correct === chosen;
    const next = prev.current + 1;
    const newCorrectCount = prev.correctCount + (isCorrect ? 1 : 0);
    const newRecord: ProblemRecord = {
      ...q,
      id: prev.current + 1,
      userAnswer: chosen,
      isCorrect,
    };
    const newRecords = [...prev.records, newRecord];

    if (next >= prev.questions.length) {
      saveRecords(REVIEW_BEGINNER_LEVEL_KEY, newRecords);
      const params = new URLSearchParams({
        score: String(newCorrectCount),
        total: String(prev.questions.length),
        mode: 'review_beginner',
      });
      navigate(`/training/preflop-beginner/result?${params.toString()}`);
      return;
    }
    setState({
      kind: 'ready',
      questions: prev.questions,
      current: next,
      correctCount: newCorrectCount,
      records: newRecords,
    });
    Promise.resolve().then(() => {
      advancingRef.current = false;
    });
  };

  if (state.kind === 'loading') {
    return <div style={pageStyle}><div style={infoStyle}>復習問題を読み込み中…</div></div>;
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
          <span style={progressLabelStyle}>復習 (初級)</span>
          <span style={progressCountStyle}>
            {state.current + 1} / {state.questions.length}
          </span>
        </div>
        <div style={progressBarOuterStyle} aria-hidden>
          <div style={{ ...progressBarInnerStyle, width: `${progress}%` }} />
        </div>
      </header>

      <main style={mainStyle}>
        <PokerTable
          mePosition={q.myPosition}
          opener={q.opener}
          foldedSet={q.foldedBefore}
        />

        <section style={handSectionStyle}>
          <span style={handLabelStyle}>ハンド</span>
          <CardSet
            cards={q.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
            size="lg"
            gap={6}
          />
        </section>

        <section style={actionRowStyle}>
          <button
            type="button"
            onClick={() => advance('participate', state)}
            style={joinBtnStyle}
          >
            参加
          </button>
          <button
            type="button"
            onClick={() => advance('fold', state)}
            style={foldBtnStyle}
          >
            参加しない
          </button>
        </section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (TrainingPlay と同等)
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
const actionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.7rem',
  marginTop: 'auto',
};
const joinBtnStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.45rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const foldBtnStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  background: '#fff',
  color: THEME.textPrimary,
  border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
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
