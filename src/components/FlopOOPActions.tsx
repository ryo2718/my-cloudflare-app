// Phase R1 scaffolding — 中身は Phase R3 で実装。
//
// 元要件 §5: OOP アクション一覧 (table 形式、5 列)
//   ヘッダ: "OOP: <position>"
//   行: [記号] [アクション名] [サイズ%] [混合戦略%] [実行ボタン]
//   0% 行は非表示、既存 STRATEGY_TEXT_COLORS + classifyByPlayRate 流用。
//
// Q3 確定: tentative commit pattern.
//   ユーザー OOP click → onTentativeSelect(actionCode)
//   親 (FlopStrategyView) が tempChain 作成 + IP node fetch を起動
//   pending 中は OOP 行で選択 action を highlight + 再 click で取消

import type { ActionSolution, FlopAvailableAction } from '../types/flop';

export interface FlopOOPActionsProps {
  oopPosition: string;
  actions: ReadonlyArray<FlopAvailableAction>;
  totals: ReadonlyArray<ActionSolution>;
  afterAggression: boolean;
  pendingAction: string | null;
  onTentativeSelect: (actionCode: string) => void;
  /** pendingAction を null に戻す (再 click)。 */
  onCancelPending: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function FlopOOPActions(_props: FlopOOPActionsProps) {
  return null; // TODO Phase R3: 5 列 table + tentative highlight + 取消
}
