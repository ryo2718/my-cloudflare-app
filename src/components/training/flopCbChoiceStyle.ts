// フロップ中級CB の選択肢 (check / 各サイズ% / ALLIN) のラベル・表示順・配色。
// 配色: 色相を振った6色ランプ (フロップ中級のベットサイズ標準配色)。小さいサイズほど暖色、
// 大きいサイズほど赤〜紫。小領域 (グリッドの小セル) で隣接しても見分けられる。
// この6色は training 配下に閉じて定義し、共通基盤 (actionColors/theme) には足さない。

import { ACTION_BUTTON_COLORS, type ActionButtonColor } from './actionButtonStyle';

/** 表示/選択順 (check → 小さいサイズ → ALLIN)。 */
export const FLOP_CB_ORDER: ReadonlyArray<string> = ['check', '10', '20', '25', '33', '50', '75', '125', 'ALLIN'];

/**
 * フロップ中級のベットサイズ標準配色 (6色ランプ)。
 *   check=緑 / 33=アンバー / 50=コーラル / 75=赤 / 125=濃い赤 / ALLIN=紫。
 */
export const FLOP_SIZE_COLORS: Record<string, string> = {
  check: '#3B8A1E',
  '33': '#EF9F27',
  '50': '#D85A30',
  '75': '#E24B4A',
  '125': '#A32D2D',
  ALLIN: '#534AB7',
};

/** バケット → ランプ色。未定義サイズはコーラルにフォールバック。 */
export function flopSizeColor(bucket: string): string {
  return FLOP_SIZE_COLORS[bucket] ?? '#D85A30';
}

/** 選択肢ラベル。 */
export function flopCbLabel(choice: string): string {
  if (choice === 'check') return 'チェック';
  if (choice === 'ALLIN') return 'オールイン';
  return `ベット${choice}%`;
}

/**
 * 選択肢ボタンの配色。枠線・色チップ・チェックボックスは6色ランプ (flopSizeColor)。
 *   - check → 緑ボタン (ACTION_BUTTON_COLORS.check)
 *   - ALLIN → 紫ボタン (ACTION_BUTTON_COLORS.allin)
 *   - ベット → 地色は淡い暖色 / 枠+チップはランプ色 (アンバー→濃赤)。
 */
export function flopCbColor(choice: string): ActionButtonColor {
  if (choice === 'check') return ACTION_BUTTON_COLORS.check;
  if (choice === 'ALLIN') return ACTION_BUTTON_COLORS.allin;
  const ramp = flopSizeColor(choice);
  return { bg: '#FBF7F1', border: ramp, text: '#3d2f1f', check: ramp };
}

/** availableActions に対応するラベル Record を作る。 */
export function flopCbLabels(choices: ReadonlyArray<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of choices) out[c] = flopCbLabel(c);
  return out;
}
