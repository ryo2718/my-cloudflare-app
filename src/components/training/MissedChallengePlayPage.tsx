// /quiz/review/preflop/{level}/play?count=N&filter=F: 間違えた問題の挑戦モード。
// 採点はするが DB には書き込まない (training_results / problem_attempts / missed_problems 更新なし)。
// 完了後、 sessionStorage 経由で MissedChallengeResultPage に結果を渡す。
// ポジション別 (ep/lp/blind) はスライダー / ノード別複数選択 / limp 緩和に対応。

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { navigate } from '../../router/router-core';
import { apiGetMissedProblems, type MissedLevel } from '../../api/missedProblems';
import {
  recordToBeginnerQuestion,
  recordToIntermediateQuestion,
} from '../../data/training/reviewMode';
import { recordToPositionalQuestion } from '../../data/training/positionalReview';
import {
  loadPositionalNode,
  positionalNodeFile,
  scorePositionalPoints,
  type PositionalQuestion,
  type PositionalResponse,
} from '../../data/training/preflopIntermediatePositional';
import type { CorrectAnswer, PreflopQuestion } from '../../data/training/preflopBeginner';
import {
  scoreAnswer,
  ACTIONS,
  type Action,
  type IntermediateQuestion,
} from '../../data/training/preflopIntermediate';
import type { Position } from '../../types/strategy';
import { CardSet } from '../CardSet';
import { ActionTable } from './ActionTable';
import { beginnerNodeFile } from '../../data/training/preflopBeginner';
import { IntermediateChoices } from './IntermediateChoices';
import { SliderChoice } from './SliderChoice';
import { PositionalChoices } from './PositionalChoices';
import { positionalPillStyle } from './positionalPill';
import { intermediateScenarioLabel, rangeFileFor } from './intermediateScenarioLabel';
import { QuitButton } from './QuitButton';
import { THEME } from '../../styles/theme';
import {
  saveChallengeResult,
  scoreMatchesFilter,
  type MissedChallengeItem,
  type MissedChallengeResult,
  type MissedReviewLevel,
  type MissedFilter,
} from './missedChallengeStore';
import type { Rank, Suit } from '../../types/card';

interface Props {
  level: MissedLevel;
  count: number;
  filter: MissedFilter;
}

const POSITIONAL_LEVELS: ReadonlyArray<MissedLevel> = ['ep', 'lp', 'blind'];
function isPositionalLevel(l: MissedLevel): boolean {
  return POSITIONAL_LEVELS.includes(l);
}

interface PreparedBeginner { kind: 'beginner'; missed_problem_id: number; question: PreflopQuestion }
interface PreparedIntermediate { kind: 'intermediate'; missed_problem_id: number; question: IntermediateQuestion }
interface PreparedPositional { kind: 'positional'; missed_problem_id: number; question: PositionalQuestion }
type Prepared = PreparedBeginner | PreparedIntermediate | PreparedPositional;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'ready'; questions: Prepared[]; current: number; results: MissedChallengeItem[] };

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const LEVEL_LABEL: Record<MissedLevel, string> = {
  beginner: '初級',
  intermediate: '中級 総合',
  ep: '中級 EP',
  lp: '中級 LP',
  blind: '中級 Blind',
};

export function MissedChallengePlayPage({ level, count, filter }: Props) {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const advancingRef = useRef(false);

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    apiGetMissedProblems(sid, { level, limit: 1000 })
      .then(async (rows) => {
        const filtered = rows.filter((r) => scoreMatchesFilter(r.score_obtained, filter));
        const taken = shuffle(filtered).slice(0, count);
        const prepared: Prepared[] = [];
        if (isPositionalLevel(level)) {
          for (const r of taken) {
            const file = positionalNodeFile(r.scenario_type, {
              hero: r.hero_position as Position,
              opener: (r.opener_position ?? null) as Position | null,
              threeBettor: (r.three_bettor_position ?? undefined) as Position | undefined,
            });
            const hands = file ? await loadPositionalNode(file) : null;
            const q = recordToPositionalQuestion(r, hands);
            if (q) prepared.push({ kind: 'positional', missed_problem_id: r.id, question: q });
          }
        } else {
          for (const r of taken) {
            if (level === 'beginner') {
              const q = recordToBeginnerQuestion(r);
              if (q) prepared.push({ kind: 'beginner', missed_problem_id: r.id, question: q });
            } else {
              const q = recordToIntermediateQuestion(r);
              if (q) prepared.push({ kind: 'intermediate', missed_problem_id: r.id, question: q });
            }
          }
        }
        if (cancelled) return;
        if (prepared.length === 0) {
          setState({ kind: 'empty' });
          return;
        }
        setState({ kind: 'ready', questions: prepared, current: 0, results: [] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [auth.sessionId, level, count, filter]);

  const finish = (allResults: MissedChallengeItem[]) => {
    const perfect = allResults.filter((r) => r.is_perfect).length;
    const result: MissedChallengeResult = {
      level: level as MissedReviewLevel,
      total: allResults.length,
      perfect_count: perfect,
      items: allResults,
    };
    saveChallengeResult(result);
    navigate(`/quiz/review/preflop/${level}/result`);
  };

  const pushResult = (item: MissedChallengeItem) => {
    if (state.kind !== 'ready') return;
    const newResults = [...state.results, item];
    const next = state.current + 1;
    if (next >= state.questions.length) {
      finish(newResults);
      return;
    }
    setState({ kind: 'ready', questions: state.questions, current: next, results: newResults });
    Promise.resolve().then(() => {
      advancingRef.current = false;
    });
  };

  const advanceBeginner = (chosen: CorrectAnswer) => {
    if (state.kind !== 'ready' || advancingRef.current) return;
    const item = state.questions[state.current];
    if (item.kind !== 'beginner') return;
    advancingRef.current = true;
    const isCorrect = item.question.correct === chosen;
    pushResult({
      missed_problem_id: item.missed_problem_id,
      hand: item.question.hand,
      scenario_label:
        item.question.scenario === 'open'
          ? `${item.question.myPosition} オープン判定`
          : `vs ${item.question.opener} open`,
      final_score: isCorrect ? 1 : -1,
      is_perfect: isCorrect,
    });
  };

  const advanceIntermediate = (selected: ReadonlyArray<Action>) => {
    if (state.kind !== 'ready' || advancingRef.current) return;
    const item = state.questions[state.current];
    if (item.kind !== 'intermediate') return;
    advancingRef.current = true;
    const finalScore = scoreAnswer(item.question.strategy, selected).finalScore;
    pushResult({
      missed_problem_id: item.missed_problem_id,
      hand: item.question.hand,
      scenario_label: intermediateScenarioLabel(item.question),
      final_score: finalScore,
      is_perfect: finalScore === 2,
    });
  };

  const advancePositional = (res: PositionalResponse) => {
    if (state.kind !== 'ready' || advancingRef.current) return;
    const item = state.questions[state.current];
    if (item.kind !== 'positional') return;
    advancingRef.current = true;
    const points = scorePositionalPoints(item.question, res);
    pushResult({
      missed_problem_id: item.missed_problem_id,
      hand: item.question.hand,
      scenario_label: item.question.label,
      final_score: points,
      is_perfect: points === 2,
    });
  };

  if (state.kind === 'loading') {
    return <div style={pageStyle}><div style={infoStyle}>問題を読み込み中…</div></div>;
  }
  if (state.kind === 'error') {
    return <div style={pageStyle}><div style={errorStyle}>取得失敗: {state.message}</div></div>;
  }
  if (state.kind === 'empty') {
    return (
      <div style={pageStyle}>
        <div style={errorBoxStyle}>
          <span>挑戦できる問題がありません。</span>
          <button type="button" onClick={() => navigate(`/quiz/review/preflop/${level}`)} style={errorBtnStyle}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  const total = state.questions.length;
  const progress = ((state.current + 1) / total) * 100;
  const item = state.questions[state.current];

  return (
    <div style={pageStyle}>
      <header style={headerBarStyle}>
        <div style={progressTopStyle}>
          <span style={progressLabelStyle}>プリフロップ{LEVEL_LABEL[level]} 挑戦モード</span>
          <span style={progressCountStyle}>{state.current + 1} / {total}</span>
          <QuitButton />
        </div>
        <div style={progressBarOuterStyle} aria-hidden>
          <div style={{ ...progressBarInnerStyle, width: `${progress}%` }} />
        </div>
      </header>

      <main style={mainStyle}>
        {item.kind === 'beginner' && (
          <BeginnerStage q={item.question} onAnswer={advanceBeginner} key={state.current} />
        )}
        {item.kind === 'intermediate' && (
          <IntermediateStage q={item.question} onAnswer={advanceIntermediate} key={state.current} />
        )}
        {item.kind === 'positional' && (
          <PositionalStage q={item.question} onAnswer={advancePositional} key={state.current} />
        )}
      </main>
    </div>
  );
}

function BeginnerStage({ q, onAnswer }: { q: PreflopQuestion; onAnswer: (a: CorrectAnswer) => void }) {
  return (
    <>
      <ActionTable file={beginnerNodeFile(q)} mePosition={q.myPosition} animate />
      <section style={handSectionStyle}>
        <span style={handLabelStyle}>ハンド</span>
        <CardSet cards={q.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))} size="lg" gap={6} />
      </section>
      <section style={actionRowStyle}>
        <button type="button" onClick={() => onAnswer('participate')} style={joinBtnStyle}>参加</button>
        <button type="button" onClick={() => onAnswer('fold')} style={foldBtnStyle}>参加しない</button>
      </section>
    </>
  );
}

function IntermediateStage({ q, onAnswer }: { q: IntermediateQuestion; onAnswer: (sel: ReadonlyArray<Action>) => void }) {
  void ACTIONS;
  const scenarioPill = useMemo(() => intermediateScenarioLabel(q), [q]);
  return (
    <>
      <div style={orangePillStyle}>{scenarioPill}</div>
      <ActionTable file={rangeFileFor(q)} mePosition={q.myPosition} animate />
      <section style={handSectionStyle}>
        <span style={handLabelStyle}>ハンド</span>
        <CardSet cards={q.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))} size="lg" gap={6} />
      </section>
      <IntermediateChoices onSubmit={onAnswer} />
    </>
  );
}

function PositionalStage({ q, onAnswer }: { q: PositionalQuestion; onAnswer: (res: PositionalResponse) => void }) {
  return (
    <>
      <div style={positionalPillStyle(q.scenarioKey)}>{q.label}</div>
      <ActionTable
        file={positionalNodeFile(q.scenarioKey, { hero: q.myPosition, opener: q.opener, threeBettor: q.threeBettor })}
        mePosition={q.myPosition}
        animate
      />
      <section style={handSectionStyle}>
        <span style={handLabelStyle}>ハンド</span>
        <CardSet cards={q.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))} size="lg" gap={6} />
      </section>
      {q.format === 'slider' ? (
        <SliderChoice
          actionLabel={q.actionLabels[q.sliderAction]}
          onSubmit={(pct) => onAnswer({ kind: 'slider', pct })}
          onSkip={() => onAnswer({ kind: 'skip' })}
        />
      ) : (
        <PositionalChoices
          availableActions={q.availableActions}
          actionLabels={q.actionLabels}
          onSubmit={(selections) => onAnswer({ kind: 'select', selections })}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = { minHeight: '100vh', background: THEME.bg, display: 'flex', flexDirection: 'column' };
const headerBarStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', background: '#fff', borderBottom: `1px solid ${THEME.border}` };
const progressTopStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.85rem' };
const progressLabelStyle: CSSProperties = { fontWeight: 700, color: THEME.textPrimary };
const progressCountStyle: CSSProperties = { color: THEME.textSecondary, fontVariantNumeric: 'tabular-nums' };
const progressBarOuterStyle: CSSProperties = { height: 6, background: THEME.cellEmpty, borderRadius: 3, overflow: 'hidden' };
const progressBarInnerStyle: CSSProperties = { height: '100%', background: THEME.accent, transition: 'width 0.2s' };
const mainStyle: CSSProperties = { flex: 1, padding: '1rem', maxWidth: 520, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' };
const handSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
const handLabelStyle: CSSProperties = { fontSize: '0.72rem', color: THEME.textSecondary, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' };
const orangePillStyle: CSSProperties = { alignSelf: 'flex-start', fontSize: '0.78rem', fontWeight: 700, color: '#993C1D', background: '#FAEEDA', border: '1px solid #E5A551', borderRadius: '999px', padding: '0.2rem 0.7rem' };
const actionRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginTop: 'auto' };
const joinBtnStyle: CSSProperties = { padding: '0.85rem 1rem', background: THEME.accent, color: '#fff', border: 'none', borderRadius: '0.45rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const foldBtnStyle: CSSProperties = { padding: '0.85rem 1rem', background: '#fff', color: THEME.textPrimary, border: `1.5px solid ${THEME.border}`, borderRadius: '0.45rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const infoStyle: CSSProperties = { margin: 'auto', color: THEME.textMuted };
const errorStyle: CSSProperties = { margin: 'auto', color: THEME.errorText };
const errorBoxStyle: CSSProperties = { margin: 'auto', padding: '1rem 1.2rem', background: THEME.errorBg, border: `1px solid ${THEME.errorBorder}`, color: THEME.errorText, borderRadius: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const errorBtnStyle: CSSProperties = { padding: '0.45rem 1rem', background: THEME.accent, color: '#fff', border: 'none', borderRadius: '0.35rem', fontFamily: 'inherit', cursor: 'pointer' };
