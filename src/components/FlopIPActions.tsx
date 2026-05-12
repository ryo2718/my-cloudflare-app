// Phase R1 scaffolding — 中身は Phase R4 で実装。
//
// 元要件 §6: IP アクション一覧 (OOP 決定後に表示)
//   ヘッダ: "IP: <position>"
//   初期状態: 「OOP の選択待ち」 (grayed out)、actions/totals は undefined
//   OOP tentative pick 後: tempChain で fetch した nextNode の actions/totals を表示
//   IP click → onCommit(actionCode) で chain 確定 + OOP の次ターンへ進む
//
// 表示形式は FlopOOPActions と同じ (5 列 table)。

import type { ActionSolution, FlopAvailableAction } from '../types/flop';

export interface FlopIPActionsProps {
  ipPosition: string;
  /** OOP が pending 中 (= tempChain fetch 済) でなければ null/undefined。 */
  actions?: ReadonlyArray<FlopAvailableAction>;
  totals?: ReadonlyArray<ActionSolution>;
  afterAggression: boolean;
  /** 子ノード fetch 中なら true → loading 表示。 */
  loading?: boolean;
  /** IP がクリック → 親 (FlopStrategyView) が chain を確定。 */
  onCommit: (actionCode: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function FlopIPActions(_props: FlopIPActionsProps) {
  return null; // TODO Phase R4: 待機状態 + actions/totals 表示 + commit
}
