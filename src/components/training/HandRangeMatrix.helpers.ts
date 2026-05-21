// HandRangeMatrix 用の純粋ヘルパー (react-refresh の only-export-components 規約回避のため分離)。

import type { HandStrategy } from '../../data/training/preflopBeginner';

export const MATRIX_RANKS: ReadonlyArray<string> = [
  'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
];

/**
 * アクションごとのセル色。
 *  - allin: 紫
 *  - raise: 赤
 *  - call:  緑
 *  - check: 緑 (call と同色。受け身に進むアクションなので同種扱い)
 *  - fold:  青 (#378ADD)
 *
 * 「前のノードに存在しないハンド (全戦略 0%)」 は paintCell が null を返し、
 * 呼び出し側でクリーム色 (空白) を描画する。
 */
export const ACTION_BG: Record<string, string> = {
  allin: '#993C9D',
  raise: '#E24B4A',
  call:  '#639922',
  check: '#639922', // = call (同色)
  fold:  '#378ADD',
};

/** そのノードのレンジに check を持つハンドがあるか (凡例の緑表記をコール/チェックで出し分ける)。 */
export function hasCheckAction(hands: Record<string, HandStrategy>): boolean {
  return Object.values(hands).some((h) => (h.check ?? 0) > 0);
}

const MIN_FREQ = 0.01;

export interface CellSegment {
  color: string;
  /** 0-100 (%): セル内の高さ比率。 */
  ratio: number;
}

export interface CellPaint {
  /** 縦積みセグメント (上から allin 紫 → raise 赤 → call 緑 → fold 青)。 */
  segments: CellSegment[] | null;
}

/**
 * 戦略 → セル縦積みセグメント。
 *  - 各 freq が 0 のセグメントは含まない (描画スキップ)
 *  - 全戦略合計 < MIN_FREQ → segments=null (= 親ノードに存在しないハンド)
 *  - 各 ratio は total で正規化した比率 (合計 100)
 *
 * 例: A8s = {allin: 0, raise: 0, call: 58.1, fold: 41.9}
 *   → segments = [{green, 58.1}, {blue, 41.9}]
 *   (上から: 緑 → 青の縦積み)
 *
 * 100% fold のハンドはセル全体が青になる (空白ではない)。
 */
export function paintCell(strategy: HandStrategy | undefined): CellPaint {
  if (!strategy) return { segments: null };
  const allin = strategy.allin ?? 0;
  const raise = strategy.raise ?? 0;
  const call = strategy.call ?? 0;
  const check = strategy.check ?? 0;
  const fold = strategy.fold ?? 0;
  // check を含めて合計 (limp pot の BB 等。check 漏れで全 raise / クリーム化していたバグ修正)。
  const total = allin + raise + call + check + fold;
  if (total < MIN_FREQ) return { segments: null };

  // 上から順: allin (紫) → raise (赤) → call (緑) → check (ティール) → fold (青)
  const segments: CellSegment[] = [];
  const norm = (v: number) => (v / total) * 100;
  if (allin > 0) segments.push({ color: ACTION_BG.allin, ratio: norm(allin) });
  if (raise > 0) segments.push({ color: ACTION_BG.raise, ratio: norm(raise) });
  if (call > 0) segments.push({ color: ACTION_BG.call, ratio: norm(call) });
  if (check > 0) segments.push({ color: ACTION_BG.check, ratio: norm(check) });
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
