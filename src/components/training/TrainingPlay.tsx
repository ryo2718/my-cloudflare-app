// トレーニング問題画面 (初級・中級共有)。
//
// フロー:
//   1. マウント時に generatePreflopQuestions() で 20 問生成
//   2. 1 問ずつ表示: PokerTable + 2 枚のハンド (PlayingCard) + [参加] [参加しない]
//   3. 選択 → 即次の問題へ (正誤表示なし)
//   4. 中級 (timeLimitSec=20) の場合、各問題で countdown、time-out は "fold" 扱い
//   5. 20 問完了 → result 画面へ score を query string で渡す
//
// 途中離脱対策:
//   - LocalStorage には何も保存しない (リロード = 全リセット)
//   - beforeunload で確認ダイアログ (誤タップ防止)
//   - logout / ホーム遷移 等の SPA 内遷移は AppHeader を使わないことで防止
//
// 結果画面の保存は TrainingPlay が直接やらず、 TrainingResult 側で POST する。

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import {
  generatePreflopQuestions,
  type CorrectAnswer,
  type PreflopQuestion,
} from '../../data/training/preflopBeginner';
import {
  clearRecords,
  saveRecords,
  type ProblemRecord,
} from '../../data/training/recordsStore';
import {
  trainingPath,
  type TrainingLevel,
} from '../../data/trainingCatalog';
import { apiPostMissedProblems, type MissedProblemInput } from '../../api/missedProblems';
import { apiPostProblemAttempts, type ProblemAttemptInput } from '../../api/statistics';
import { useAuth } from '../../hooks/useAuth';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import { PokerTable } from './PokerTable';
import type { Suit, Rank } from '../../types/card';

export interface TrainingPlayProps {
  level: TrainingLevel;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      questions: PreflopQuestion[];
      current: number;
      correctCount: number;
      records: ProblemRecord[];
    };

export function TrainingPlay({ level }: TrainingPlayProps) {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const advancingRef = useRef(false);

  // beforeunload: 途中離脱の警告
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
    let cancelled = false;
    // 旧セッションの記録があれば破棄してから生成 (中断後再開で混在を防ぐ)
    clearRecords(level.key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    generatePreflopQuestions(level.questionCount ?? 20)
      .then((questions) => {
        if (cancelled) return;
        setState({ kind: 'ready', questions, current: 0, correctCount: 0, records: [] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [level.key, level.questionCount]);

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
      // 全問終了: 記録を保存してから result 画面へ navigate
      saveRecords(level.key, newRecords);
      // Step 3a: 初級でも満点未達 (isCorrect=false) の問題を DB に記録。
      // 戦略データがある record のみ送信 (古いキャッシュ等で strategy なしの場合 skip)。
      if (auth.sessionId) {
        const missed: MissedProblemInput[] = newRecords
          .filter((r) => !r.isCorrect && r.strategy)
          .map((r) => {
            const scenarioType = r.scenario === 'open' ? 'beginner_open' : 'beginner_vs_open';
            // 初級 UI の 2 択を DB 形式 (4 アクション系) に変換
            const selections =
              r.userAnswer === 'participate'
                ? (r.strategy!.call > r.strategy!.raise ? ['call'] : ['raise'])
                : ['fold'];
            return {
              training_type: 'preflop_beginner' as const,
              scenario_type: scenarioType,
              hero_position: r.myPosition,
              opener_position: r.opener,
              three_bettor_position: null,
              hand: r.hand,
              user_selections: selections,
              gto_strategy: {
                allin: r.strategy!.allin ?? 0,
                raise: r.strategy!.raise ?? 0,
                call: r.strategy!.call ?? 0,
                fold: r.strategy!.fold ?? 0,
              },
              score_obtained: r.isCorrect ? 1 : -1,
              is_timeout: false,
            };
          });
        if (missed.length > 0) {
          void apiPostMissedProblems(auth.sessionId, missed).catch(() => {
            /* silent fallback */
          });
        }
        // Step 3b: 全 20 問を problem_attempts に記録 (統計集計用)。
        const attempts: ProblemAttemptInput[] = newRecords.map((r) => ({
          training_type: 'preflop_beginner' as const,
          scenario_type: r.scenario === 'open' ? 'beginner_open' : 'beginner_vs_open',
          hero_position: r.myPosition,
          opener_position: r.opener,
          three_bettor_position: null,
          hand: r.hand,
          score_obtained: r.isCorrect ? 1 : -1,
          is_timeout: false,
        }));
        void apiPostProblemAttempts(auth.sessionId, attempts).catch(() => {
          /* silent fallback */
        });
      }
      const params = new URLSearchParams({
        score: String(newCorrectCount),
        total: String(prev.questions.length),
      });
      navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
      return;
    }
    setState({
      kind: 'ready',
      questions: prev.questions,
      current: next,
      correctCount: newCorrectCount,
      records: newRecords,
    });
    // 次の問題でも advance できるよう、microtask 後にロック解除
    Promise.resolve().then(() => {
      advancingRef.current = false;
    });
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
          <span style={progressLabelStyle}>
            {level.label}
          </span>
          <span style={progressCountStyle}>
            {state.current + 1} / {state.questions.length}
          </span>
        </div>
        <div style={progressBarOuterStyle} aria-hidden>
          <div style={{ ...progressBarInnerStyle, width: `${progress}%` }} />
        </div>
      </header>

      {typeof level.timeLimitSec === 'number' && (
        <Countdown
          key={`${state.current}-${q.hand}`}
          seconds={level.timeLimitSec}
          onTimeUp={() => advance('fold', state)}
        />
      )}

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
// Countdown
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

const loadingStyle: CSSProperties = {
  margin: 'auto',
  fontSize: '0.95rem',
  color: THEME.textMuted,
};

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
