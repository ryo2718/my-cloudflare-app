// 複数選択形式問題の選択肢ボタン配色 (中級総合 / EP / LP / Blind 共通)。
// 薄い地色 + 濃い 2px 枠 + 濃い文字。チェックボックスは濃色 (選択時は塗りつぶし + 白チェック)。

import { ACTION_COLOR } from '../../styles/actionColors';

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

/** 中級総合 (4択固定) のアクションラベル。選択肢ボタン / 復習画面で参照。 */
export const ACTION_LABEL: Record<'allin' | 'raise' | 'call' | 'fold', string> = {
  allin: 'オールイン',
  raise: 'レイズ',
  call: 'コール',
  fold: 'フォールド',
};

// 濃枠 (border) はアクション色の単一定義 (ACTION_COLOR) を参照。
// 薄地 (bg) / 文字色 (text) / チェックボックス塗り (check) は装飾シェードで据え置き。
export const ACTION_BUTTON_COLORS: Record<ButtonActionKey, ActionButtonColor> = {
  allin: { bg: '#EEEDFE', border: ACTION_COLOR.allin, text: '#26215C', check: '#534AB7' },
  raise: { bg: '#FCEBEB', border: ACTION_COLOR.raise, text: '#501313', check: '#A32D2D' },
  call: { bg: '#EAF3DE', border: ACTION_COLOR.call, text: '#173404', check: '#3B6D11' },
  // チェック (BB vs limp の passive) は コール と同系 (緑)。
  check: { bg: '#EAF3DE', border: ACTION_COLOR.check, text: '#173404', check: '#3B6D11' },
  fold: { bg: '#E6F1FB', border: ACTION_COLOR.fold, text: '#042C53', check: '#185FA5' },
};
