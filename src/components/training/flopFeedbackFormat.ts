// フロップ即時フィードバックのアクション表示フォーマット (ラベル + バー色)。
// コンポーネントから分離してテスト可能にする。色トークンは共通定義 ACTION_COLOR を参照。

import { ACTION_COLOR } from '../../styles/actionColors';

/**
 * action_code + betsize_by_pot → ラベル。
 *   - X → 'チェック' / RAI → 'オールイン'
 *   - R<size> → 'ベット {bet/pot の %}' (例 'ベット 33%')
 */
export function actionFreqLabel(code: string, bp: number): string {
  if (code === 'X') return 'チェック';
  if (code === 'RAI') return 'オールイン';
  if (code.startsWith('R')) return `ベット ${Math.round(bp * 100)}%`;
  return code;
}

/**
 * 頻度バーの色。
 *   - チェック (X) → 緑 (call と同色 = ACTION_COLOR.check)
 *   - ポットオーバー (bp > 1.0) → 紫 (ACTION_COLOR.allin)
 *   - それ以外のベット → betsize_by_pot で 薄赤(明度72%)→濃赤(明度38%) に連続濃化
 */
export function barColor(code: string, bp: number): string {
  if (code === 'X') return ACTION_COLOR.check;
  if (bp > 1.0) return ACTION_COLOR.allin;
  const t = Math.max(0, Math.min(1, bp));
  return `hsl(2, 68%, ${(72 - t * 34).toFixed(0)}%)`;
}
