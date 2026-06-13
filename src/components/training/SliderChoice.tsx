// スライダー形式問題の回答 UI。用語定義は src/data/training/GLOSSARY.md を参照。
//
// raise 頻度を 0–100%・10% 刻みのスライダーで回答する。
//   - [回答する]: 現在のスライダー値で onSubmit(pct)
//   - [この問題を飛ばす]: onSkip() (0pt 扱い)

import { useState, type CSSProperties } from 'react';
import { SLIDER_MAX, SLIDER_MIN, SLIDER_STEP } from '../../data/training/sliderScoring';
import { THEME } from '../../styles/theme';
import { ACTION_COLOR } from '../../styles/actionColors';

export interface SliderChoiceProps {
  /** スライダーで頻度を問うアクション名 (表示用、例: "レイズ")。 */
  actionLabel: string;
  onSubmit: (pct: number) => void;
  onSkip: () => void;
  disabled?: boolean;
}

export function SliderChoice({ actionLabel, onSubmit, onSkip, disabled = false }: SliderChoiceProps) {
  const [value, setValue] = useState(50);

  return (
    <div style={containerStyle}>
      <p style={promptStyle}>{actionLabel}の頻度は?(10% 刻み)</p>

      {/* ショートカット: 100% / 0% に即セットして自動的に回答確定 (テンポ向上)。
          スライダー手動操作 + 「回答する」も従来どおり使える。 */}
      <div style={quickRowStyle}>
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setValue(SLIDER_MAX);
            onSubmit(SLIDER_MAX);
          }}
          disabled={disabled}
          style={quickRaiseStyle}
        >
          100%{actionLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setValue(SLIDER_MIN);
            onSubmit(SLIDER_MIN);
          }}
          disabled={disabled}
          style={quickFoldStyle}
        >
          100%フォールド
        </button>
      </div>

      <div style={valueRowStyle}>
        <span style={valueStyle}>{value}%</span>
      </div>

      <div style={sliderRowStyle}>
        <button
          type="button"
          onClick={() => !disabled && setValue(SLIDER_MIN)}
          disabled={disabled}
          style={endBtnStyle}
          aria-label="0%にする"
        >
          0%
        </button>
        <input
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={SLIDER_STEP}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(Number(e.target.value))}
          style={rangeStyle}
          aria-label={`${actionLabel}の頻度`}
        />
        <button
          type="button"
          onClick={() => !disabled && setValue(SLIDER_MAX)}
          disabled={disabled}
          style={endBtnStyle}
          aria-label="100%にする"
        >
          100%
        </button>
      </div>
      <div style={scaleRowStyle} aria-hidden>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>

      <button
        type="button"
        onClick={() => !disabled && onSubmit(value)}
        disabled={disabled}
        style={disabled ? submitDisabledStyle : submitStyle}
      >
        回答する
      </button>
      <button
        type="button"
        onClick={() => !disabled && onSkip()}
        disabled={disabled}
        style={skipStyle}
      >
        この問題を飛ばす
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

const valueRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};

const valueStyle: CSSProperties = {
  fontSize: '1.8rem',
  fontWeight: 800,
  color: THEME.accent,
  fontVariantNumeric: 'tabular-nums',
};

const sliderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const rangeStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  accentColor: THEME.accent,
  cursor: 'pointer',
};

const endBtnStyle: CSSProperties = {
  flexShrink: 0,
  padding: '0.4rem 0.6rem',
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontVariantNumeric: 'tabular-nums',
};
const quickRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.5rem',
};
const quickBtnBase: CSSProperties = {
  padding: '0.7rem 0.5rem',
  borderRadius: '0.45rem',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: '1.5px solid',
};
const quickRaiseStyle: CSSProperties = {
  ...quickBtnBase,
  background: ACTION_COLOR.raise,
  color: '#fff',
  borderColor: ACTION_COLOR.raise,
};
const quickFoldStyle: CSSProperties = {
  ...quickBtnBase,
  background: ACTION_COLOR.fold,
  color: '#fff',
  borderColor: ACTION_COLOR.fold,
};

const scaleRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.72rem',
  color: THEME.textSecondary,
  fontVariantNumeric: 'tabular-nums',
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
  marginTop: '0.3rem',
};

const submitDisabledStyle: CSSProperties = {
  ...submitStyle,
  background: THEME.textMuted,
  cursor: 'not-allowed',
};

const skipStyle: CSSProperties = {
  padding: '0.6rem 1rem',
  background: 'transparent',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
