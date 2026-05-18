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

export interface CellSegment {
  color: string;
  /** 0-100 (%): セル内の高さ比率。 */
  ratio: number;
}

export interface CellPaint {
  /** 縦積みセグメント (上から allin 紫 → raise 赤 → call 緑 → fold 白)。 */
  segments: CellSegment[] | null;
}

/**
 * 戦略 → セル縦積みセグメント。
 *  - 各 freq が 0 のセグメントは含まない (描画スキップ)
 *  - play 系合計 < MIN_FREQ → segments=null (親ノードに来ない or 100% fold)
 *  - 各 ratio は total で正規化した比率 (合計 100)
 *
 * 例: A8s = {allin: 0, raise: 0, call: 58.1, fold: 41.9}
 *   → segments = [{green, 58.1}, {white, 41.9}]
 *   (上から: 緑 → 白の縦積み)
 */
export function paintCell(strategy: HandStrategy | undefined): CellPaint {
  if (!strategy) return { segments: null };
  const allin = strategy.allin ?? 0;
  const raise = strategy.raise ?? 0;
  const call = strategy.call ?? 0;
  const fold = strategy.fold ?? 0;
  const total = allin + raise + call + fold;
  if (total < MIN_FREQ) return { segments: null };
  const playTotal = allin + raise + call;
  if (playTotal < MIN_FREQ) return { segments: null };

  // 上から順: allin (紫) → raise (赤) → call (緑) → fold (白)
  const segments: CellSegment[] = [];
  const norm = (v: number) => (v / total) * 100;
  if (allin > 0) segments.push({ color: ACTION_BG.allin, ratio: norm(allin) });
  if (raise > 0) segments.push({ color: ACTION_BG.raise, ratio: norm(raise) });
  if (call > 0) segments.push({ color: ACTION_BG.call, ratio: norm(call) });
  if (fold > 0) segments.push({ color: ACTION_BG.fold, ratio: norm(fold) });
  if (segments.length === 0) return { segments: null };
  return { segments };
}

/** (row, col) → ハンド表記。 */
export function cellHand(row: number, col: number): string {
  const r1 = MATRIX_RANKS[row];
  const r2 = MATRIX_RANKS[col];
  if (row === col) return r1 + r1;
  if (row < col) return r1 + r2 + 's';
  return r2 + r1 + 'o';
}
