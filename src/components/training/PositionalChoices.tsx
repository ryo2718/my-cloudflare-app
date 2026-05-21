// 中級ポジション別 (Blind 等) の複数選択 UI。用語定義は src/data/training/GLOSSARY.md を参照。
//
// 既存 IntermediateChoices と異なり、ノードで実際に使われるアクションだけを表示し、
// ラベルもノードに応じて出し分ける (例: SB open の call=「リンプ」、BB vs limp の check=「チェック」)。
// 配色は actionButtonStyle.ts で全レベル共通 (薄い地色 + 濃い 2px 枠)。

import { useState, type CSSProperties } from 'react';
import type { PositionalAction } from '../../data/training/preflopIntermediatePositional';
import { ACTION_BUTTON_COLORS } from './actionButtonStyle';
import { THEME } from '../../styles/theme';

const ACTION_ORDER: ReadonlyArray<PositionalAction> = ['allin', 'raise', 'call', 'check', 'fold'];

export interface PositionalChoicesProps {
  /** 表示するアクション (ノード由来の順序は ACTION_ORDER で正規化)。 */
  availableActions: ReadonlyArray<PositionalAction>;
  /** アクション別ラベル。 */
  actionLabels: Record<PositionalAction, string>;
  onSubmit: (selections: ReadonlyArray<PositionalAction>) => void;
  disabled?: boolean;
}

export function PositionalChoices({
  availableActions,
  actionLabels,
  onSubmit,
  disabled = false,
}: PositionalChoicesProps) {
  const [selected, setSelected] = useState<ReadonlyArray<PositionalAction>>([]);
  const actions = ACTION_ORDER.filter((a) => availableActions.includes(a));

  const toggle = (a: PositionalAction) => {
    if (disabled) return;
    setSelected((prev) => {
      if (prev.includes(a)) return prev.filter((x) => x !== a);
      const next = [...prev, a];
      next.sort((x, y) => ACTION_ORDER.indexOf(x) - ACTION_ORDER.indexOf(y));
      return next;
    });
  };

  return (
    <div style={containerStyle}>
      <p style={promptStyle}>どう応答する?(複数選択可)</p>
      <ul style={listStyle}>
        {actions.map((a) => {
          const isOn = selected.includes(a);
          const color = ACTION_BUTTON_COLORS[a];
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
// Styles (IntermediateChoices と統一)
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
