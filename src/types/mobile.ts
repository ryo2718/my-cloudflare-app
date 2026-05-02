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
