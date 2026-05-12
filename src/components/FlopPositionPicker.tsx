// Phase R1 scaffolding — 中身は Phase R2 で実装。
//
// 元要件 §2: Position 選択 (2 つ)
//   ○SB ○BB ○UTG ○HJ ○CO ○BTN
//   2 つ選択、3 つ目押下で最古を pop、選択中はダーク背景 + ✓
//
// 旧 `FlopVariantSelector` の opener+responder dropdown を置き換える component。
// 出力は `positions: Position[]` (length 0-2)、親に onChange で通知。

import type { Position } from '../types/strategy';

export interface FlopPositionPickerProps {
  positions: ReadonlyArray<Position>;
  onChange: (positions: Position[]) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function FlopPositionPicker({ positions: _positions, onChange: _onChange }: FlopPositionPickerProps) {
  return null; // TODO Phase R2: 6 ボタン横並び + 選択ロジック
}
