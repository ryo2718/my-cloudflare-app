// フロップ(ポストフロップ)トレーニングの「間違えた問題」記録・再構築の共通ロジック。
//   - 記録: フロップ各プレイ画面の finish から、満点未満の問題を MissedProblemInput に変換。
//     フロップ固有情報(board / variant / pot / kind / hand)は metadata(JSON)に持つ
//     (案C: 既存 missed_problems テーブルに metadata 列を1つ追加)。
//   - 一覧ラベル: 「{ボード} {シチュエーション}」(例: "Ad Ac 3d  srp BTN vs BB")。
//   - 再構築: 保存した variant + board から実データを引いて 1 問を組み直す(正解は保存しない)。

import type { Card } from '../../types/card';
import type { Position } from '../../types/strategy';
import type {
  FlopTrainingType,
  MissedProblemInput,
  MissedProblemRow,
} from '../../api/missedProblems';
import {
  loadFlopRbData,
  recordToFlopRbQuestion,
  flopRbScenarioLabel,
  type FlopRbQuestion,
  type FlopRbPot,
  type FlopCbKind,
} from './flopIntermediateCb';
import {
  loadFlopTrainingData,
  recordToFlopBeginnerQuestion,
  flopScenarioLabel,
  type FlopQuestion,
  type FlopPot,
} from './flopBeginner';

/** metadata(JSON)に持つフロップ固有情報。 */
export interface FlopMissedMeta {
  /** データと同形式の 6 文字ボード文字列 (例 "AdAc3d")。 */
  board: string;
  variant: string;
  /** FlopRbPot('SRP'|'3bet'|'4bet'|'5bet') または FlopPot('SRP'|'3bet')。 */
  pot: string;
  /** 'cb' | 'donk' | 'bmcb'(range) / 'cb' | 'donk'(初級)。 */
  kind?: string;
  /** per-hand のみハンド (現状の menu モードは未使用)。 */
  hand?: string;
}

const PLACEHOLDER_GTO = { allin: 0, raise: 0, call: 0, fold: 0 } as const;

/** ボードカード列 → データ形式の 6 文字文字列 (parseBoard の逆)。 */
export function boardToString(board: ReadonlyArray<Card>): string {
  return board.map((c) => `${c.rank}${c.suit}`).join('');
}

/** 6 文字ボード文字列 → 表示用 ("AdAc3d" → "Ad Ac 3d")。 */
export function displayBoard(board: string): string {
  const out: string[] = [];
  for (let i = 0; i < board.length; i += 2) out.push(board.slice(i, i + 2));
  return out.join(' ');
}

/** range-bet(CB / ドンク・BMCB)の 1 問 → MissedProblemInput。 */
export function flopRbMissedInput(
  trainingType: FlopTrainingType,
  q: FlopRbQuestion,
  score: number,
): MissedProblemInput {
  const scenario_type = q.kind === 'donk' ? 'flop_donk' : q.kind === 'bmcb' ? 'flop_bmcb' : 'flop_cb';
  const meta: FlopMissedMeta = { board: boardToString(q.board), variant: q.variant, pot: q.pot, kind: q.kind };
  return {
    training_type: trainingType,
    scenario_type,
    hero_position: q.hero,
    opener_position: q.villain,
    three_bettor_position: null,
    hand: '-',
    user_selections: [],
    gto_strategy: { ...PLACEHOLDER_GTO },
    score_obtained: score,
    metadata: JSON.stringify(meta),
  };
}

/** 初級(打つ/打たない)の 1 問 → MissedProblemInput。 */
export function flopBeginnerMissedInput(q: FlopQuestion, score: number): MissedProblemInput {
  const meta: FlopMissedMeta = { board: boardToString(q.board), variant: q.variant, pot: q.pot, kind: q.type };
  return {
    training_type: 'flop_beginner',
    scenario_type: 'flop_beginner',
    hero_position: q.hero,
    opener_position: q.villain,
    three_bettor_position: null,
    hand: '-',
    user_selections: [],
    gto_strategy: { ...PLACEHOLDER_GTO },
    score_obtained: score,
    metadata: JSON.stringify(meta),
  };
}

/** row.metadata(JSON)→ FlopMissedMeta。壊れていれば null。 */
export function parseFlopMeta(row: MissedProblemRow): FlopMissedMeta | null {
  if (!row.metadata) return null;
  try {
    const m = JSON.parse(row.metadata) as Partial<FlopMissedMeta>;
    if (typeof m.board !== 'string' || typeof m.variant !== 'string' || typeof m.pot !== 'string') return null;
    return { board: m.board, variant: m.variant, pot: m.pot, kind: m.kind, hand: m.hand };
  } catch {
    return null;
  }
}

/** 一覧ラベル「{ボード} {シチュエーション}」。例: "Ad Ac 3d  srp BTN vs BB"。 */
export function flopMissedLabel(row: MissedProblemRow): string {
  const meta = parseFlopMeta(row);
  if (!meta) return row.hand;
  const hero = row.hero_position as Position;
  const villain = (row.opener_position ?? hero) as Position;
  const scenario =
    row.training_type === 'flop_beginner'
      ? flopScenarioLabel({ pot: meta.pot as FlopPot, hero, villain })
      : flopRbScenarioLabel({ pot: meta.pot as FlopRbPot, hero, villain, kind: meta.kind as FlopCbKind });
  return `${displayBoard(meta.board)}  ${scenario}`;
}

/** 復習再出題: 保存済み row 群から range-bet 問題を再構築 (見つからない行は除外)。 */
export async function reconstructFlopRbQuestions(rows: ReadonlyArray<MissedProblemRow>): Promise<FlopRbQuestion[]> {
  const data = await loadFlopRbData();
  const out: FlopRbQuestion[] = [];
  let id = 0;
  for (const row of rows) {
    const meta = parseFlopMeta(row);
    if (!meta) continue;
    const q = recordToFlopRbQuestion(data, meta.variant, meta.board);
    if (q) out.push({ ...q, id: (id += 1) });
  }
  return out;
}

/** 復習再出題: 保存済み row 群から初級問題を再構築 (見つからない行は除外)。 */
export async function reconstructFlopBeginnerQuestions(rows: ReadonlyArray<MissedProblemRow>): Promise<FlopQuestion[]> {
  const data = await loadFlopTrainingData();
  const out: FlopQuestion[] = [];
  let id = 0;
  for (const row of rows) {
    const meta = parseFlopMeta(row);
    if (!meta) continue;
    const q = recordToFlopBeginnerQuestion(data, meta.variant, meta.board);
    if (q) out.push({ ...q, id: (id += 1) });
  }
  return out;
}
