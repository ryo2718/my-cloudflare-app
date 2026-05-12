// モバイル UI 用の型と判定ヘルパー (PC側 src/types/strategy.ts の Position とは別ドメインで管理)。

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type MobileTab = 'range' | 'eval' | 'flop';

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

/** opener が SB の時のみ意味を持つ — open (Raise 2.5x) か limp (Call 1bb) か。
 *  非 SB opener の場合は常に 'open'。 */
export type OpenerAction = 'open' | 'limp';

export interface MobileState {
  opener: Position | null;
  /** SB の最初のアクション。default 'open'、SB が limp する経路を選んだ時だけ 'limp'。 */
  openerAction: OpenerAction;
  responder: Position | null;
  /** preflop node_path のスタック。 末尾が現在表示中のノード。
   *   length 0 → 未選択
   *   length 1 → opener のみ ("utg")
   *   length 2 → responder まで ("utg", "utgr_btn")
   *   length 3+ → action button で深掘りした状態 */
  historyPaths: string[];
}

export function createInitialState(): MobileState {
  return { opener: null, openerAction: 'open', responder: null, historyPaths: [] };
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

/** path 内に call(=limp) segment があるか (例: 'sbc_bb' → true) */
function hasLimpSegment(path: string): boolean {
  return path.split('_').some((s) => s.endsWith('c') && !s.endsWith('ai'));
}

/** raise 段数 → 次の raise の表示名。
 *  limp pot の最初の raise (= iso) は "open" ではなく "raise" と表示する。 */
export function nextRaiseLabel(path: string): string {
  const next = countRaises(path) + 1;
  if (next === 1) return hasLimpSegment(path) ? 'raise' : 'open';
  if (next === 2) return '3bet';
  if (next === 3) return '4bet';
  if (next === 4) return '5bet';
  return '6bet';
}

