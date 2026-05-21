// 複数選択形式問題の選択肢ボタン配色 (中級総合 / EP / LP / Blind 共通)。
// 薄い地色 + 濃い 2px 枠 + 濃い文字。チェックボックスは濃色 (選択時は塗りつぶし + 白チェック)。

export interface ActionButtonColor {
  /** ボタン地色 (常時)。 */
  bg: string;
  /** ボタン枠線 (2px)。 */
  border: string;
  /** ラベル文字色。 */
  text: string;
  /** チェックボックスの色 (枠 / 選択時の塗り)。 */
  check: string;
}

export type ButtonActionKey = 'allin' | 'raise' | 'call' | 'check' | 'fold';

export const ACTION_BUTTON_COLORS: Record<ButtonActionKey, ActionButtonColor> = {
  allin: { bg: '#EEEDFE', border: '#534AB7', text: '#26215C', check: '#534AB7' },
  raise: { bg: '#FCEBEB', border: '#E24B4A', text: '#501313', check: '#A32D2D' },
  call: { bg: '#EAF3DE', border: '#639922', text: '#173404', check: '#3B6D11' },
  // チェック (BB vs limp の passive) は コール と同系 (緑)。
  check: { bg: '#EAF3DE', border: '#639922', text: '#173404', check: '#3B6D11' },
  fold: { bg: '#E6F1FB', border: '#378ADD', text: '#042C53', check: '#185FA5' },
};
