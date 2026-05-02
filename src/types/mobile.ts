// モバイル UI 用の型と判定ヘルパー (PC側 src/types/strategy.ts の Position とは別ドメインで管理)。

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type MobileTab = 'range' | 'eval';

/** 6max preflop アクション順 (UTG が最初、BB が最後) */
export const POSITION_ORDER: ReadonlyArray<Position> = [
  'UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB',
];

/** 1回目タップ (opener) として選べないポジション */
export const POSITIONS_NO_FIRST_TAP: ReadonlyArray<Position> = ['BB'];

export interface PositionSelection {
  /** 1回目タップ — 青系 */
  opener: Position | null;
  /** 2回目タップ — 赤系 */
  responder: Position | null;
}

/** 1回目タップ可能か */
export function canSelectAsOpener(candidate: Position): boolean {
  return !POSITIONS_NO_FIRST_TAP.includes(candidate);
}

/** 2回目タップ可能か (opener より後ろの席だけ) */
export function canSelectAsResponder(
  opener: Position | null,
  candidate: Position,
): boolean {
  if (!opener) return false;
  if (candidate === opener) return false;
  return POSITION_ORDER.indexOf(candidate) > POSITION_ORDER.indexOf(opener);
}

// ---------------------------------------------------------------------------
// GameState (Phase 3+) — アクション履歴ベースのモバイル状態。
// historyPaths は preflop ノード path の累積。最後の要素が現在地。
// ---------------------------------------------------------------------------

export interface MobileState {
  opener: Position | null;
  responder: Position | null;
  /** preflop node_path のスタック。 末尾が現在表示中のノード。
   *   length 0 → 未選択
   *   length 1 → opener のみ ("utg")
   *   length 2 → responder まで ("utg", "utgr_btn")
   *   length 3+ → action button で深掘りした状態 */
  historyPaths: string[];
}

export function createInitialState(): MobileState {
  return { opener: null, responder: null, historyPaths: [] };
}

/** path の末尾セグメントから hero を抽出 ("utgr_btn" → "BTN") */
export function heroFromPath(path: string): Position {
  const seg = path.split('_').pop() ?? '';
  return seg.toUpperCase() as Position;
}

/** opener/responder のうち、currentHero でない方を返す */
export function oppositeHero(
  currentHero: Position,
  opener: Position,
  responder: Position,
): Position {
  return currentHero === opener ? responder : opener;
}

/** path 中の raise 段数 (suffix='r' の数) を数える。次の raise の段数 = +1 */
export function countRaises(path: string): number {
  return path.split('_').filter((s) => s.endsWith('r')).length;
}

/** raise 段数 → 次の raise の表示名 */
export function nextRaiseLabel(path: string): string {
  const next = countRaises(path) + 1;
  if (next === 1) return 'open';
  if (next === 2) return '3bet';
  if (next === 3) return '4bet';
  if (next === 4) return '5bet';
  return '6bet';
}

