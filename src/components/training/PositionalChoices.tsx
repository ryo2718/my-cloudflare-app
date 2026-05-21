// 中級ポジション別 (Blind 等) の複数選択 UI。用語定義は src/data/training/GLOSSARY.md を参照。
//
// 既存 IntermediateChoices と異なり、ノードで実際に使われるアクションだけを表示し、
// ラベルもノードに応じて出し分ける (例: SB open の call=「リンプ」、BB vs limp の check=「チェック」)。

import { useState, type CSSProperties } from 'react';
import type { PositionalAction } from '../../data/training/preflopIntermediatePositional';
import { THEME } from '../../styles/theme';

const ACTION_ORDER: ReadonlyArray<PositionalAction> = ['allin', 'raise', 'call', 'check', 'fold'];

// 未選択でも枠線がしっかり見えるよう offBorder は実色 (フル彩度) に。
// 選択中は onBg で背景が色づき、メリハリをつける。
const ACTION_COLOR: Record<PositionalAction, { base: string; offBorder: string; onBg: string }> = {
  allin: { base: '#993C9D', offBorder: '#993C9D', onBg: 'rgba(153, 60, 157, 0.18)' }, // 紫
  raise: { base: '#E24B4A', offBorder: '#E24B4A', onBg: 'rgba(226, 75, 74, 0.18)'  }, // 赤
  call:  { base: '#639922', offBorder: '#639922', onBg: 'rgba(99, 153, 34, 0.20)'  }, // 緑
  check: { base: '#2F8F83', offBorder: '#2F8F83', onBg: 'rgba(47, 143, 131, 0.18)' }, // 青緑
  fold:  { base: '#378ADD', offBorder: '#378ADD', onBg: 'rgba(55, 138, 221, 0.18)' }, // 青
};

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
          const color = ACTION_COLOR[a];
          const row: CSSProperties = isOn
            ? { ...rowBase, background: color.onBg, borderColor: color.base, fontWeight: 700 }
            : { ...rowBase, borderColor: color.offBorder };
          return (
            <li key={a}>
              <button
                type="button"
                onClick={() => toggle(a)}
                disabled={disabled}
                style={row}
                aria-pressed={isOn}
              >
                <span style={{ ...checkboxBase, color: color.base }} aria-hidden>
                  {isOn ? '☑' : '☐'}
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
  background: '#fff',
  border: `2px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.98rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  color: THEME.textPrimary,
};
const checkboxBase: CSSProperties = { fontSize: '1.1rem', width: '1.2rem', display: 'inline-block', textAlign: 'center' };
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
