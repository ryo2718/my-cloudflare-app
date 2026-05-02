// 各ポジションの Open (RFI) レンジに対するハンド評価ユーティリティ。

export type EvaluationSymbol = '◎' | '○' | '🔼' | '❌';

export const OPEN_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const;
export type OpenPosition = (typeof OPEN_POSITIONS)[number];

export interface OpenEvaluation {
  position: OpenPosition;
  /** 0–100 (%)。raise アクション頻度。 */
  raiseRate: number;
  symbol: EvaluationSymbol;
}

/**
 * raise率 (0–100%) → 評価記号。
 *  - ◎: 90% 以上 (ほぼ確実に open)
 *  - ○: 30%以上 90%未満 (混合戦略)
 *  - 🔼: 10%以上 30%未満 (たまに open)
 *  - ❌: 10% 未満 (基本 fold)
 */
export function classifyRaiseRate(raise: number): EvaluationSymbol {
  if (raise >= 90) return '◎';
  if (raise >= 30) return '○';
  if (raise >= 10) return '🔼';
  return '❌';
}
