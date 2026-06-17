// Phase 2a: 新 preflop ノード -> 既存 HandMatrix が要求する {strategy, actions} へ変換。
// HandMatrix は変更しないため、その入力契約 (utils/normalize.ts と同一) に合わせる:
//   - actions: [fold, call, raise, allin] 固定 (色も同一)
//   - strategy[hand] = [fold, call, raise, allin] を 0-1 化

import type { Action, Strategy } from '../../types/strategy';
import type { PreflopV2Node } from './types';

// utils/normalize.ts の FIXED_ACTIONS と同一 (色・順序)。HandMatrix と配色を揃える。
export const PREFLOP_V2_ACTIONS: ReadonlyArray<Action> = [
  { id: 'fold', label: 'Fold', size_bb: 0, color: '#0284c7' },
  { id: 'call', label: 'Call', size_bb: 1, color: '#16a34a' },
  { id: 'raise', label: 'Raise', size_bb: 0, color: '#ef4444' },
  { id: 'allin', label: 'All-in', size_bb: 100, color: '#9333ea' },
];

/** ノードの hands を HandMatrix 用の sparse Strategy ([fold,call,raise,allin] / 0-1) に変換。 */
export function nodeToStrategy(node: PreflopV2Node): Strategy {
  const strategy: Record<string, number[]> = {};
  for (const [hand, h] of Object.entries(node.hands)) {
    strategy[hand] = [
      (h.fold ?? 0) / 100,
      (h.call ?? 0) / 100,
      (h.raise ?? 0) / 100,
      (h.allin ?? 0) / 100,
    ];
  }
  return strategy as Strategy;
}
