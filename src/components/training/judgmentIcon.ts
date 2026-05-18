// 中級採点結果のテキスト記号アイコン。
//
// 既存の utils/strategySymbol.ts と同じ記号セット (◎/○/△/✕) と
// 色テーブル (getSymbolStyle) を流用。バツは U+2715 (✕)。
//   +2pt → ◎ (満点)
//   +1pt → ○ (部分点)
//    0pt → △ (わからない / 何も選ばない)
//   -1pt → ✕ (即-1pt または時間切れ)

import { getSymbolStyle, type StrategySymbol } from '../../utils/strategySymbol';

export type { StrategySymbol };

export function judgmentIcon(finalScore: number): StrategySymbol {
  if (finalScore >= 2) return '◎';
  if (finalScore === 1) return '○';
  if (finalScore === 0) return '△';
  return '✕';
}

/** 既存 strategySymbol の getSymbolStyle を流用して symbolColor を返す。 */
export function judgmentColor(finalScore: number): string {
  return getSymbolStyle(judgmentIcon(finalScore)).symbolColor;
}

/** 振り返り画面のバッジ用に枠線色も併せて返す。 */
export function judgmentStyle(finalScore: number): { symbol: string; border: string; label: string } {
  const sty = getSymbolStyle(judgmentIcon(finalScore));
  return { symbol: sty.symbolColor, border: sty.border, label: sty.labelColor };
}
