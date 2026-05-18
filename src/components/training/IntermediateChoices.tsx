// 中級トレーニングの応答 UI: 4 アクションのチェックボックス + [回答する] ボタン。
//
// 親 (TrainingPlay) から:
//   - onSubmit(selections): ユーザーが [回答する] を押した時に呼ばれる
//   - disabled: タイマー切れ等で操作不可状態
//
// 「何も選ばない」も valid な解答 (= 0pt)。
// 「即-1pt」の警告は出さない (採点はサーバー/親側で行う)。

import { useState, type CSSProperties } from 'react';
import { ACTIONS, type Action } from '../../data/training/preflopIntermediate';
import { THEME } from '../../styles/theme';

const ACTION_LABEL: Record<Action, string> = {
  allin: 'オールイン',
  raise: 'レイズ',
  call: 'コール',
  fold: 'フォールド',
};

/** アクションごとの基調色 (off=ボーダー・on=背景)。 */
const ACTION_COLOR: Record<Action, { base: string; on: string; onText: string }> = {
  allin: { base: '#993C9D', on: '#993C9D', onText: '#fff' },   // 紫
  raise: { base: '#E24B4A', on: '#E24B4A', onText: '#fff' },   // 赤
  call:  { base: '#639922', on: '#639922', onText: '#fff' },   // 緑
  fold:  { base: '#378ADD', on: '#378ADD', onText: '#fff' },   // 青
};

export interface IntermediateChoicesProps {
  /** ユーザーが [回答する] を押したときに呼ばれる。selections は順序固定 (ACTIONS 順)。 */
  onSubmit: (selections: ReadonlyArray<Action>) => void;
  /** タイマー切れ等で操作不可。 */
  disabled?: boolean;
  /** 問題が切り替わったら state リセット用 key を親で変更する想定。 */
}

export function IntermediateChoices({ onSubmit, disabled = false }: IntermediateChoicesProps) {
  const [selected, setSelected] = useState<ReadonlyArray<Action>>([]);

  const toggle = (a: Action) => {
    if (disabled) return;
    setSelected((prev) => {
      if (prev.includes(a)) return prev.filter((x) => x !== a);
      // ACTIONS 順を保ちつつ追加
      const next = [...prev, a];
      next.sort((x, y) => ACTIONS.indexOf(x) - ACTIONS.indexOf(y));
      return next;
    });
  };

  const submit = () => {
    if (disabled) return;
    onSubmit(selected);
  };

  return (
    <div style={containerStyle}>
      <p style={promptStyle}>どう応答する?(複数選択可)</p>
      <ul style={listStyle}>
        {ACTIONS.map((a) => {
          const isOn = selected.includes(a);
          const color = ACTION_COLOR[a];
          const baseRow: CSSProperties = {
            ...rowBase,
            borderColor: color.base,
          };
          const onRow: CSSProperties = {
            ...rowBase,
            background: color.on,
            color: color.onText,
            borderColor: color.base,
            fontWeight: 700,
          };
          return (
            <li key={a}>
              <button
                type="button"
                onClick={() => toggle(a)}
                disabled={disabled}
                style={isOn ? onRow : baseRow}
                aria-pressed={isOn}
              >
                <span
                  style={{
                    ...checkboxBase,
                    color: isOn ? color.onText : color.base,
                  }}
                  aria-hidden
                >
                  {isOn ? '☑' : '☐'}
                </span>
                <span>{ACTION_LABEL[a]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        style={disabled ? submitDisabledStyle : submitStyle}
      >
        回答する
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
};

const promptStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

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

const checkboxBase: CSSProperties = {
  fontSize: '1.1rem',
  width: '1.2rem',
  display: 'inline-block',
  textAlign: 'center',
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

const submitDisabledStyle: CSSProperties = {
  ...submitStyle,
  background: THEME.textMuted,
  cursor: 'not-allowed',
};

export { ACTION_LABEL };
