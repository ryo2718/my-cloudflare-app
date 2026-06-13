// トレーニング問題画面 (初級)。
//
// フロー:
//   1. マウント時に generatePreflopQuestions() で 20 問生成
//   2. 1 問ずつ表示: PokerTable + 2 枚のハンド (PlayingCard) + [参加] [参加しない]
//   3. 選択 → 即次の問題へ (正誤表示なし。即時フィードバック ON 時は答えを表示)
//   4. 中級 (timeLimitSec=20) の場合、各問題で countdown、time-out は "fold" 扱い
//   5. 20 問完了 → result 画面へ score を query string で渡す
//
// 状態機械・回答処理・即時フィードバック・タイマー・離脱警告は共通の useTrainingHarness に集約。

import { useState, type CSSProperties } from 'react';
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
import { ActionTable } from './ActionTable';
import { QuitButton } from './QuitButton';
import { InstantFeedback } from './InstantFeedback';
import { NodeRangeSection } from './NodeRangeSection';
import { Countdown } from './Countdown';
import { useTrainingHarness } from './useTrainingHarness';
import { DebugAnswerBar } from './DebugAnswerBar';
import { beginnerViewInfo } from './trainingViewInfo';
import { loadInstantFeedback } from '../../data/userPreferences';
import type { Suit, Rank } from '../../types/card';

export interface TrainingPlayProps {
  level: TrainingLevel;
}

export function TrainingPlay({ level }: TrainingPlayProps) {
  const auth = useAuth();
  const [instant] = useState<boolean>(loadInstantFeedback);

  const finish = (records: ProblemRecord[]) => {
    saveRecords(level.key, records);
    // Step 3a: 初級でも満点未達 (isCorrect=false) の問題を DB に記録。
    // 戦略データがある record のみ送信 (古いキャッシュ等で strategy なしの場合 skip)。
    if (auth.sessionId) {
      const missed: MissedProblemInput[] = records
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
      const attempts: ProblemAttemptInput[] = records.map((r) => ({
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
    const correctCount = records.filter((r) => r.isCorrect).length;
    const params = new URLSearchParams({
      score: String(correctCount),
      total: String(records.length),
    });
    navigate(`${trainingPath(level.key, 'result')}?${params.toString()}`);
  };

  const { state, animReady, setAnimReady, feedback, onAnswer, onProceed, debugComplete } = useTrainingHarness<
    PreflopQuestion,
    CorrectAnswer,
    ProblemRecord
  >({
    load: () => generatePreflopQuestions(level.questionCount ?? 20),
    onLoadStart: () => clearRecords(level.key),
    reloadKey: `${level.key}:${level.questionCount ?? 20}`,
    instant,
    scorePoints: (q, chosen) => (q.correct === chosen ? 1 : -1),
    buildRecord: (q, chosen, i) => ({ ...q, id: i + 1, userAnswer: chosen, isCorrect: q.correct === chosen }),
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
  const view = beginnerViewInfo(q);
  const progress = ((state.current + 1) / state.questions.length) * 100;

  // デバッグ (admin 専用) picker (response = 'participate' | 'fold')。
  const dbgCorrect = (qq: typeof q): CorrectAnswer => qq.correct;
  const dbgWrong = (qq: typeof q): CorrectAnswer => (qq.correct === 'participate' ? 'fold' : 'participate');
  const dbgRandom = (): CorrectAnswer => (Math.random() < 0.5 ? 'participate' : 'fold');

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

      {animReady && !feedback && typeof level.timeLimitSec === 'number' && (
        <Countdown
          key={`${state.current}-${q.hand}`}
          seconds={level.timeLimitSec}
          onTimeUp={() => onAnswer('fold')}
        />
      )}

      <main style={mainStyle}>
        <ActionTable
          file={view.nodeFile}
          mePosition={q.myPosition}
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
          <InstantFeedback points={feedback.points} onNext={onProceed}>
            <NodeRangeSection file={view.nodeFile} highlightHand={view.hand} />
          </InstantFeedback>
        ) : (
          <section style={actionRowStyle}>
            <button type="button" onClick={() => onAnswer('participate')} style={joinBtnStyle}>
              参加
            </button>
            <button type="button" onClick={() => onAnswer('fold')} style={foldBtnStyle}>
              参加しない
            </button>
          </section>
        )}
      </main>
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
