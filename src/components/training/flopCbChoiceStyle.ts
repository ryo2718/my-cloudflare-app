// フロップ中級CB の選択肢 (check / 各サイズ% / ALLIN) のラベル・表示順・配色。
// 配色: check=緑 / オールイン=紫 / ベットはサイズで濃淡 (薄赤→濃赤→ポットオーバー紫)。
// ベットの濃淡は即時フィードバックの頻度バー (barColor) と同一ロジックを流用し、
// 同じサイズが同じ色になるようにする。共通基盤 (actionColors) には新色を足さない。

import { ACTION_BUTTON_COLORS, type ActionButtonColor } from './actionButtonStyle';
import { ACTION_COLOR } from '../../styles/actionColors';
import { barColor } from './flopFeedbackFormat';

/** 表示/選択順 (check → 小さいサイズ → ALLIN)。 */
export const FLOP_CB_ORDER: ReadonlyArray<string> = ['check', '10', '20', '25', '33', '50', '75', '125', 'ALLIN'];

/** 選択肢ラベル。 */
export function flopCbLabel(choice: string): string {
  if (choice === 'check') return 'チェック';
  if (choice === 'ALLIN') return 'オールイン';
  return `ベット${choice}%`;
}

/**
 * 選択肢の配色。
 *   - check → 緑 (ACTION_BUTTON_COLORS.check)
 *   - ALLIN → 紫 (ACTION_BUTTON_COLORS.allin)
 *   - ベット → サイズ% で濃淡。枠線・色チップ・チェックボックスは barColor(= 頻度バーと同色)。
 *     ポットオーバー (125% 等, bp>1) は紫 (allin と同系)。地色/文字色は raise を流用。
 */
export function flopCbColor(choice: string): ActionButtonColor {
  if (choice === 'check') return ACTION_BUTTON_COLORS.check;
  if (choice === 'ALLIN') return ACTION_BUTTON_COLORS.allin;
  const pct = Number(choice);
  if (!Number.isFinite(pct)) return ACTION_BUTTON_COLORS.raise;
  const strong = barColor('R', pct / 100); // 薄赤→濃赤→(>100%)紫: 頻度バーと同一
  if (strong === ACTION_COLOR.allin) return ACTION_BUTTON_COLORS.allin; // ポットオーバー → 紫
  return { ...ACTION_BUTTON_COLORS.raise, border: strong, check: strong };
}

/** availableActions に対応するラベル Record を作る。 */
export function flopCbLabels(choices: ReadonlyArray<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of choices) out[c] = flopCbLabel(c);
  return out;
}
