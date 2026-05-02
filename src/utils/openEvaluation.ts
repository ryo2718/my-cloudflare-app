// 各ポジションの Open (RFI) レンジに対するハンド評価ユーティリティ。
// 判定ロジックは strategySymbol.ts (play率 = raise + call) を参照。

import type { StrategySymbol } from './strategySymbol';

export const OPEN_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const;
export type OpenPosition = (typeof OPEN_POSITIONS)[number];

export interface OpenEvaluation {
  position: OpenPosition;
  /** 0–100 (%) — raise アクション頻度 */
  raiseRate: number;
  /** 0–100 (%) — call アクション頻度 (SB のみ非0、他は通常 0) */
  callRate: number;
  /** 0–100 (%) — fold アクション頻度 */
  foldRate: number;
  symbol: StrategySymbol;
}
