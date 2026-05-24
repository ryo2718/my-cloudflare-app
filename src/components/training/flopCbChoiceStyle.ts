// フロップ中級CB の選択肢 (check / 各サイズ% / ALLIN) のラベル・表示順・配色。
// 配色は既存の選択肢ボタン色 (ACTION_BUTTON_COLORS) を流用: check=緑 / ベット=赤 / ALLIN=紫。

import { ACTION_BUTTON_COLORS, type ActionButtonColor } from './actionButtonStyle';

/** 表示/選択順 (check → 小さいサイズ → ALLIN)。 */
export const FLOP_CB_ORDER: ReadonlyArray<string> = ['check', '10', '20', '25', '33', '50', '75', '125', 'ALLIN'];

/** 選択肢ラベル。 */
export function flopCbLabel(choice: string): string {
  if (choice === 'check') return 'チェック';
  if (choice === 'ALLIN') return 'オールイン';
  return `ベット${choice}%`;
}

/** 選択肢の配色 (check=緑 / ベット=赤 / ALLIN=紫)。 */
export function flopCbColor(choice: string): ActionButtonColor {
  if (choice === 'check') return ACTION_BUTTON_COLORS.check;
  if (choice === 'ALLIN') return ACTION_BUTTON_COLORS.allin;
  return ACTION_BUTTON_COLORS.raise;
}

/** availableActions に対応するラベル Record を作る。 */
export function flopCbLabels(choices: ReadonlyArray<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of choices) out[c] = flopCbLabel(c);
  return out;
}
