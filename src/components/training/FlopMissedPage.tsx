// ポストフロップ(フロップ)トレーニングの「間違えた問題」一覧 + 復習(再出題)。
//   - FlopMissedListPage: /quiz/review/flop/{trainingType}
//       間違えた問題を「{ボード} {シチュエーション}」で一覧。挑戦する / 復習リストから消す。
//   - FlopMissedPlayPage: /quiz/review/flop/{trainingType}/play
//       保存済み row を再構築し、既存のフロップ画面を「復習モード」で再出題 (pt 加算なし)。
//
// 案2: 既存の TrainingPlayFlop / TrainingPlayFlopIntermediate に review プロップを渡して流用する。

import { useEffect, useState, type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import { useAuth } from '../../hooks/useAuth';
import {
  apiGetMissedProblems,
  apiRemoveMissedProblem,
  type FlopTrainingType,
  type MissedTierKey,
  type MissedProblemRow,
} from '../../api/missedProblems';
import {
  flopMissedLabel,
  reconstructFlopRbQuestions,
  reconstructFlopBeginnerQuestions,
} from '../../data/training/flopMissedMode';
import type { FlopRbQuestion, FlopRbRecord } from '../../data/training/flopIntermediateCb';
import type { FlopQuestion, FlopRecord } from '../../data/training/flopBeginner';
import { scoreFlopRb } from '../../data/training/flopIntermediateCb';
import { TRAINING_CATALOG, type TrainingLevel } from '../../data/trainingCatalog';
import { AppHeader } from '../AppHeader';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';
import { TrainingPlayFlop } from './TrainingPlayFlop';
import { TrainingPlayFlopIntermediate } from './TrainingPlayFlopIntermediate';

/** フロップの間違えた問題 level (per-type 互換 + 階級 tier)。 */
export type FlopMissedKey = FlopTrainingType | Extract<MissedTierKey, 'tier_flop_beginner' | 'tier_flop_intermediate'>;

const FLOP_LABEL: Record<FlopMissedKey, string> = {
  flop_beginner: '初級',
  srp_non_blind: 'レンジCB SRP Blind以外',
  srp_limp_blind: 'レンジCB SRP リンプ&Blind',
  '3bp_4bp_5bp_non_blind': 'レンジCB 3BP/4BP Blind以外',
  '3bp_4bp_5bp_blind': 'レンジCB 3BP/4BP/5BP Blind',
  donk_bmcb: 'レンジドンク/BMCB',
  tier_flop_beginner: '初級',
  tier_flop_intermediate: '中級',
};

function levelFor(trainingType: FlopMissedKey): TrainingLevel {
  const found = TRAINING_CATALOG.flatMap((c) => c.levels).find((l) => l.key === trainingType);
  return (
    found ?? { key: trainingType, label: FLOP_LABEL[trainingType], points: 1, questionCount: null, timeLimitSec: 'none', implemented: true }
  );
}

/** 初級扱いか (フロップ初級 single / tier)。それ以外 (CB系/ドンク/中級tier) は rb。 */
const isBeginner = (t: FlopMissedKey) => t === 'flop_beginner' || t === 'tier_flop_beginner';

// ---------------------------------------------------------------------------
// 一覧
// ---------------------------------------------------------------------------

export function FlopMissedListPage({ trainingType }: { trainingType: FlopMissedKey }) {
  const auth = useAuth();
  const [rows, setRows] = useState<MissedProblemRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(null);
    setErr(null);
    apiGetMissedProblems(sid, { level: trainingType, limit: 1000 })
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => {});
    return () => { cancelled = true; };
  }, [auth.sessionId, trainingType]);

  const handleRemove = async (id: number) => {
    if (!auth.sessionId) return;
    try {
      await apiRemoveMissedProblem(auth.sessionId, id);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    } catch {
      /* silent */
    }
  };

  const available = (rows?.length ?? 0) > 0;

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <Link to="/quiz" style={crumbStyle}>← トレーニングに戻る</Link>
        <h1 style={titleStyle}>間違えた問題 - ポストフロップ{FLOP_LABEL[trainingType]}</h1>

        <section style={challengeBoxStyle} aria-label="挑戦モード">
          <button
            type="button"
            onClick={() => navigate(`/quiz/review/flop/${trainingType}/play`)}
            disabled={!available}
            style={available ? challengeBtnStyle : challengeBtnDisabledStyle}
          >
            挑戦する
          </button>
        </section>

        <header style={listHeaderStyle}>保存されている問題一覧</header>
        {err && <div style={errorStyle}>取得失敗: {err}</div>}
        {!err && rows === null && <div style={infoStyle}>読み込み中…</div>}
        {!err && rows && rows.length === 0 && <div style={infoStyle}>該当する問題はありません。</div>}
        {!err && rows && rows.length > 0 && (
          <ul style={listStyle}>
            {rows.map((row) => (
              <li key={row.id} style={itemStyle}>
                <span style={labelPillStyle}>{flopMissedLabel(row)}</span>
                <button type="button" onClick={() => handleRemove(row.id)} style={dangerBtnStyle}>
                  復習リストから消す
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 再出題 (復習)
// ---------------------------------------------------------------------------

type PlayState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'rb'; questions: FlopRbQuestion[] }
  | { kind: 'beginner'; questions: FlopQuestion[] }
  | { kind: 'done'; correct: number; total: number };

export function FlopMissedPlayPage({ trainingType }: { trainingType: FlopMissedKey }) {
  const auth = useAuth();
  const [state, setState] = useState<PlayState>({ kind: 'loading' });
  const level = levelFor(trainingType);

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    apiGetMissedProblems(sid, { level: trainingType, limit: 1000 })
      .then(async (rows) => {
        if (isBeginner(trainingType)) {
          const qs = await reconstructFlopBeginnerQuestions(rows);
          if (!cancelled) setState(qs.length === 0 ? { kind: 'empty' } : { kind: 'beginner', questions: qs });
        } else {
          const qs = await reconstructFlopRbQuestions(rows);
          if (!cancelled) setState(qs.length === 0 ? { kind: 'empty' } : { kind: 'rb', questions: qs });
        }
      })
      .catch((e: unknown) => { if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }); });
    return () => { cancelled = true; };
  }, [auth.sessionId, trainingType]);

  if (state.kind === 'loading') return <div style={pageStyle}><div style={infoCenterStyle}>問題を読み込み中…</div></div>;
  if (state.kind === 'error') return <div style={pageStyle}><div style={infoCenterStyle}>取得失敗: {state.message}</div></div>;
  if (state.kind === 'empty') {
    return (
      <div style={pageStyle}>
        <div style={emptyBoxStyle}>
          <span>復習できる問題がありません。</span>
          <button type="button" onClick={() => navigate(`/quiz/review/flop/${trainingType}`)} style={backBtnStyle}>戻る</button>
        </div>
      </div>
    );
  }
  if (state.kind === 'done') {
    return (
      <div style={pageStyle}>
        <div style={emptyBoxStyle}>
          <span style={doneScoreStyle}>{state.correct} / {state.total}</span>
          <span style={doneNoteStyle}>復習なのでスコアは加算されません。</span>
          <button type="button" onClick={() => navigate(`/quiz/review/flop/${trainingType}`)} style={backBtnStyle}>一覧に戻る</button>
        </div>
      </div>
    );
  }

  if (state.kind === 'beginner') {
    return (
      <TrainingPlayFlop
        level={level}
        review={{
          questions: state.questions,
          onFinish: (records: FlopRecord[]) =>
            setState({ kind: 'done', correct: records.filter((r) => r.isCorrect).length, total: records.length }),
        }}
      />
    );
  }
  // rb (レンジCB / ドンク・BMCB)
  return (
    <TrainingPlayFlopIntermediate
      level={level}
      review={{
        questions: state.questions,
        onFinish: (records: FlopRbRecord[]) =>
          setState({
            kind: 'done',
            correct: records.reduce((s, r) => s + Math.max(0, scoreFlopRb(r, r.response)), 0),
            total: records.length * 2,
          }),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles (MissedProblemsListPage に準拠)
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = { minHeight: '100vh', background: THEME.bg, display: 'flex', flexDirection: 'column' };
const mainStyle: CSSProperties = { flex: 1, padding: '1.25rem 1rem', maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' };
const crumbStyle: CSSProperties = { fontSize: '0.82rem', color: THEME.textSecondary, textDecoration: 'none' };
const titleStyle: CSSProperties = { margin: 0, fontSize: '1.2rem', fontWeight: 700, color: THEME.textPrimary };
const challengeBoxStyle: CSSProperties = { display: 'flex', justifyContent: 'center', padding: '0.9rem 1rem', background: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '0.5rem' };
const challengeBtnStyle: CSSProperties = { padding: '0.75rem 2rem', background: THEME.accent, color: '#fff', border: 'none', borderRadius: '0.45rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minWidth: 160 };
const challengeBtnDisabledStyle: CSSProperties = { ...challengeBtnStyle, background: '#d6cfc1', cursor: 'not-allowed' };
const listHeaderStyle: CSSProperties = { fontSize: '0.85rem', fontWeight: 700, color: THEME.textSecondary, marginTop: '0.4rem' };
const infoStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.textMuted, padding: '0.5rem 0' };
const infoCenterStyle: CSSProperties = { margin: 'auto', color: THEME.textMuted };
const errorStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.errorText, background: THEME.errorBg, border: `1px solid ${THEME.errorBorder}`, borderRadius: '0.3rem', padding: '0.45rem 0.7rem' };
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const itemStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.55rem', padding: '0.7rem 0.85rem', background: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '0.45rem', flexWrap: 'wrap' };
const labelPillStyle: CSSProperties = { fontSize: '0.86rem', fontWeight: 700, color: '#993C1D', background: '#FAEEDA', border: '1px solid #E5A551', borderRadius: '999px', padding: '0.15rem 0.6rem' };
const dangerBtnStyle: CSSProperties = { padding: '0.45rem 0.85rem', background: '#fff', color: '#7A2A26', border: '1px solid #C25855', borderRadius: '0.35rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const emptyBoxStyle: CSSProperties = { margin: 'auto', padding: '1.2rem 1.4rem', background: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7rem' };
const backBtnStyle: CSSProperties = { padding: '0.55rem 1.4rem', background: THEME.accent, color: '#fff', border: 'none', borderRadius: '0.4rem', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const doneScoreStyle: CSSProperties = { fontSize: '1.6rem', fontWeight: 800, color: THEME.textPrimary, fontVariantNumeric: 'tabular-nums' };
const doneNoteStyle: CSSProperties = { fontSize: '0.82rem', color: THEME.textMuted };
