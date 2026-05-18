// HandRangeMatrix 用の純粋ヘルパー (react-refresh の only-export-components 規約回避のため分離)。

import { type Action } from '../../data/training/preflopIntermediate';
import type { HandStrategy } from '../../data/training/preflopBeginner';

export const MATRIX_RANKS: ReadonlyArray<string> = [
  'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
];

/**
 * アクションごとのセル色。
 *  - allin: 紫
 *  - raise: 赤
 *  - call:  緑
 *  - fold:  白 (#ffffff、緑+白の縦積みが視覚的に明確になるよう)
 */
export const ACTION_BG: Record<Action, string> = {
  allin: '#993C9D',
  raise: '#E24B4A',
  call:  '#639922',
  fold:  '#ffffff',
};

const MIN_FREQ = 0.01;

export interface CellPaint {
  /** linear-gradient string、または描画しない場合 null。 */
  background: string | null;
}

/**
 * 戦略 → セル塗り (頻度比率の縦積み gradient)。
 *  - play 系合計 < MIN_FREQ → 描画しない (= 親ノードに来ない or 100% fold)
 *  - それ以外: linear-gradient(to top, fold→call→raise→allin) で各 freq 比率を縦に積む
 *    例: Q4s = {0, 0, 24, 76} → 下 76% transparent + 上 24% 緑 → "緑 24% + 白 76%"
 */
export function paintCell(strategy: HandStrategy | undefined): CellPaint {
  if (!strategy) return { background: null };
  const allin = strategy.allin ?? 0;
  const raise = strategy.raise ?? 0;
  const call = strategy.call ?? 0;
  const fold = strategy.fold ?? 0;
  const total = allin + raise + call + fold;
  if (total < MIN_FREQ) return { background: null };
  // play 系 0 → 親ノードに来てない / 100% fold とみなして描画スキップ
  const playTotal = allin + raise + call;
  if (playTotal < MIN_FREQ) return { background: null };

  // gradient 順序: 下 (fold transparent) → 上 (allin 紫)。
  // linear-gradient(to top, ...) で配列の先頭から順に下から積まれる。
  const segments: Array<{ color: string; freq: number }> = [
    { color: ACTION_BG.fold, freq: fold },
    { color: ACTION_BG.call, freq: call },
    { color: ACTION_BG.raise, freq: raise },
    { color: ACTION_BG.allin, freq: allin },
  ];
  const stops: string[] = [];
  let cursor = 0;
  for (const seg of segments) {
    if (seg.freq <= 0) continue;
    const start = (cursor / total) * 100;
    cursor += seg.freq;
    const end = (cursor / total) * 100;
    stops.push(`${seg.color} ${start.toFixed(2)}%, ${seg.color} ${end.toFixed(2)}%`);
  }
  if (stops.length === 0) return { background: null };
  return { background: `linear-gradient(to top, ${stops.join(', ')})` };
}

/** (row, col) → ハンド表記。 */
export function cellHand(row: number, col: number): string {
  const r1 = MATRIX_RANKS[row];
  const r2 = MATRIX_RANKS[col];
  if (row === col) return r1 + r1;
  if (row < col) return r1 + r2 + 's';
  return r2 + r1 + 'o';
}
