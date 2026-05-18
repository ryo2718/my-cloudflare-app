// HandRangeMatrix 用の純粋ヘルパー (react-refresh の only-export-components 規約回避のため分離)。

import { ACTIONS, type Action } from '../../data/training/preflopIntermediate';
import type { HandStrategy } from '../../data/training/preflopBeginner';

export const MATRIX_RANKS: ReadonlyArray<string> = [
  'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
];

/** アクションごとのセル色 (主要戦略の表示)。 */
export const ACTION_BG: Record<Action, string> = {
  allin: '#993C9D',     // 紫
  raise: '#E24B4A',     // 赤
  call:  '#639922',     // 緑
  fold:  'transparent', // fold は描画しない
};

const MAJOR_THRESHOLD = 20;
const MIN_FREQ = 0.01;

export interface CellPaint {
  background: string | null;
  secondary: string | null;
}

/** 戦略 → セル塗り色を決定。fold が主要なら background null (= 描画しない)。 */
export function paintCell(strategy: HandStrategy | undefined): CellPaint {
  if (!strategy) return { background: null, secondary: null };
  const playMajors: { a: Action; freq: number }[] = [];
  for (const a of ACTIONS) {
    if (a === 'fold') continue;
    const f = strategy[a] ?? 0;
    if (f >= MAJOR_THRESHOLD) playMajors.push({ a, freq: f });
  }
  if (playMajors.length === 0) {
    const totalPlay = (strategy.allin ?? 0) + (strategy.raise ?? 0) + (strategy.call ?? 0);
    if (totalPlay < MIN_FREQ) return { background: null, secondary: null };
    const dominant = ACTIONS.filter((a) => a !== 'fold').reduce<{ a: Action; freq: number }>(
      (acc, a) => {
        const f = strategy[a] ?? 0;
        return f > acc.freq ? { a, freq: f } : acc;
      },
      { a: 'raise', freq: 0 },
    );
    if (dominant.freq < MIN_FREQ) return { background: null, secondary: null };
    return { background: ACTION_BG[dominant.a], secondary: null };
  }
  playMajors.sort((a, b) => b.freq - a.freq);
  const background = ACTION_BG[playMajors[0].a];
  const secondary = playMajors.length >= 2 ? ACTION_BG[playMajors[1].a] : null;
  return { background, secondary };
}

/** (row, col) → ハンド表記。 */
export function cellHand(row: number, col: number): string {
  const r1 = MATRIX_RANKS[row];
  const r2 = MATRIX_RANKS[col];
  if (row === col) return r1 + r1;
  if (row < col) return r1 + r2 + 's';
  return r2 + r1 + 'o';
}
