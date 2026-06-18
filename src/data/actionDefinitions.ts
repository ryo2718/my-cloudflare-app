// 戦略タブ (13x13 グリッド) のアクション色・順序の単一ソース。
// 旧 utils/normalize.ts から抽出 (normalize.ts 撤去のため)。色は単一定義
// src/styles/actionColors.ts (ACTION_COLOR) を参照 (色を複製しない / 全ビュー同一)。
// preflopV2 (新グリッド) がこれを再利用する。

import type { Action } from '../types/strategy';
import { ACTION_COLOR } from '../styles/actionColors';

export const FIXED_ACTIONS: ReadonlyArray<Action> = [
  { id: 'fold', label: 'Fold', size_bb: 0, color: ACTION_COLOR.fold },
  { id: 'call', label: 'Call', size_bb: 1, color: ACTION_COLOR.call },
  { id: 'raise', label: 'Raise', size_bb: 0, color: ACTION_COLOR.raise },
  { id: 'allin', label: 'All-in', size_bb: 100, color: ACTION_COLOR.allin },
];
