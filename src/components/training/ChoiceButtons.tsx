// 複数選択形式問題の選択肢ボタン (全モード共通)。
// 旧 IntermediateChoices (4択固定) と PositionalChoices (availableActions/ラベル可変) を統合。
// 薄い地色 + 濃い 2px 枠 + 濃い文字。チェックボックスは濃色 (選択=塗り+白チェック)。
//   - availableActions: 表示するアクション (ACTION_ORDER で表示/選択順を正規化)。
//   - actionLabels: アクション別ラベル (例 SB open の call=「リンプ」)。

import { useState, type CSSProperties } from 'react';
import { ACTION_BUTTON_COLORS, type ActionButtonColor, type ButtonActionKey } from './actionButtonStyle';
import { THEME } from '../../styles/theme';

const ACTION_ORDER: ReadonlyArray<string> = ['allin', 'raise', 'call', 'check', 'fold'];

export interface ChoiceButtonsProps<A extends string> {
  /** 表示するアクション (順序は order で正規化)。 */
  availableActions: ReadonlyArray<A>;
  /** アクション別ラベル。 */
  actionLabels: Record<A, string>;
  onSubmit: (selections: ReadonlyArray<A>) => void;
  disabled?: boolean;
  /** 表示/選択順 (既定 = プリフロのアクション順)。order に無いものは後ろに据え置き。 */
  order?: ReadonlyArray<string>;
  /** アクション別の配色 (既定 = ACTION_BUTTON_COLORS)。フロップのサイズ選択肢用に差し替え可。 */
  resolveColor?: (a: A) => ActionButtonColor;
  /** 見出し (既定 = 「どう応答する?(複数選択可)」)。 */
  prompt?: string;
  /** 各ボタン左に色チップ (縦長矩形, 枠色と同色) を表示する。サイズ別配色の識別用。 */
  showColorChip?: boolean;
}

export function ChoiceButtons<A extends string>({
  availableActions,
  actionLabels,
  onSubmit,
  disabled = false,
  order = ACTION_ORDER,
  resolveColor,
  prompt = 'どう応答する?(複数選択可)',
  showColorChip = false,
}: ChoiceButtonsProps<A>) {
  const [selected, setSelected] = useState<ReadonlyArray<A>>([]);
  const ordered = order.filter((a) => (availableActions as ReadonlyArray<string>).includes(a)) as A[];
  // order に無い available は末尾に据え置き (取りこぼし防止)。
  const extra = (availableActions as ReadonlyArray<string>).filter((a) => !order.includes(a)) as A[];
  const actions = [...ordered, ...extra];
  const colorOf = (a: A): ActionButtonColor =>
    resolveColor ? resolveColor(a) : ACTION_BUTTON_COLORS[a as ButtonActionKey];

  const toggle = (a: A) => {
    if (disabled) return;
    setSelected((prev) => {
      if (prev.includes(a)) return prev.filter((x) => x !== a);
      const next = [...prev, a];
      next.sort((x, y) => actions.indexOf(x) - actions.indexOf(y));
      return next;
    });
  };

  return (
    <div style={containerStyle}>
      <p style={promptStyle}>{prompt}</p>
      <ul style={listStyle}>
        {actions.map((a) => {
          const isOn = selected.includes(a);
          const color = colorOf(a);
          const row: CSSProperties = {
            ...rowBase,
            background: color.bg,
            borderColor: color.border,
            color: color.text,
            fontWeight: isOn ? 800 : 600,
            boxShadow: isOn ? `0 0 0 1px ${color.border} inset` : 'none',
          };
          return (
            <li key={a}>
              <button type="button" onClick={() => toggle(a)} disabled={disabled} style={row} aria-pressed={isOn}>
                {showColorChip && <span style={chipStyle(color.border)} aria-hidden />}
                <span style={checkboxStyle(isOn, color.check)} aria-hidden>
                  {isOn ? '✓' : ''}
                </span>
                <span>{actionLabels[a]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => !disabled && onSubmit(selected)}
        disabled={disabled}
        style={disabled ? submitDisabledStyle : submitStyle}
      >
        回答する
      </button>
    </div>
  );
}

/** 左の色チップ (縦長矩形)。サイズ別配色をひと目で識別できるようにする。 */
function chipStyle(color: string): CSSProperties {
  return { width: 5, height: 20, minWidth: 5, borderRadius: 2, background: color };
}

/** 選択肢チェックボックス: 未選択=濃色枠の空箱 / 選択=濃色塗り + 白チェック。 */
function checkboxStyle(on: boolean, color: string): CSSProperties {
  return {
    width: 18,
    height: 18,
    minWidth: 18,
    borderRadius: 4,
    border: `2px solid ${color}`,
    background: on ? color : 'transparent',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.6rem' };
const promptStyle: CSSProperties = { margin: 0, fontSize: '0.92rem', fontWeight: 700, color: THEME.textPrimary };
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' };
const rowBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  width: '100%',
  padding: '0.65rem 0.85rem',
  border: '2px solid',
  borderRadius: '0.4rem',
  fontSize: '0.98rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
};
const submitStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.45rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const submitDisabledStyle: CSSProperties = { ...submitStyle, background: THEME.textMuted, cursor: 'not-allowed' };
