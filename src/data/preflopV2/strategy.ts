// Phase 2a: 新 preflop ノード -> 既存 HandMatrix が要求する {strategy, actions} へ変換。
// HandMatrix は変更しないため、その入力契約 (utils/normalize.ts と同一) に合わせる:
//   - actions: [fold, call, raise, allin] 固定 (色も同一)
//   - strategy[hand] = [fold, call, raise, allin] を 0-1 化

import type { Strategy } from '../../types/strategy';
import { FIXED_ACTIONS } from '../actionDefinitions';
import type { PreflopV2Node } from './types';

// 色・順序は既存戦略タブと同一ソース (utils/normalize.ts FIXED_ACTIONS) を再利用。
// 色定義を複製しない。
export const PREFLOP_V2_ACTIONS = FIXED_ACTIONS;

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
