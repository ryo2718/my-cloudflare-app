// Flop chain の breadcrumb 表示。
// 各 step を pill 風ボタンで並べ、クリックでその位置まで chain truncate。
// 末尾の現在ノードは強調表示、リセットボタンを併置。

import type { CSSProperties } from 'react';
import { THEME } from '../styles/theme';

interface Props {
  /** 現在の variant 名 (HOME ラベル用)。 */
  variant: string;
  /** 現在の flop action chain (e.g. `["bb_b1_8", "utg_r6_35"]`)。 */
  chain: string[];
  /** 指定位置まで chain を truncate (length === 0 で root)。 */
  onTruncate: (newLength: number) => void;
  /** chain を [] に戻す。variant は維持。 */
  onReset: () => void;
}

export function FlopBreadcrumb({ variant, chain, onTruncate, onReset }: Props) {
  return (
    <nav style={navStyle} aria-label="Flop breadcrumb">
      <button
        type="button"
        onClick={() => onTruncate(0)}
        style={chain.length === 0 ? activeItemStyle : itemStyle}
        title="Root (flop start)"
      >
        🏠 {variant}
      </button>
      {chain.map((step, idx) => {
        const isLast = idx === chain.length - 1;
        return (
          <span key={idx} style={pairStyle}>
            <span style={separatorStyle}>›</span>
            <button
              type="button"
              onClick={() => onTruncate(idx + 1)}
              style={isLast ? activeItemStyle : itemStyle}
              disabled={isLast}
            >
              {formatStep(step)}
            </button>
          </span>
        );
      })}
      {chain.length > 0 && (
        <button type="button" onClick={onReset} style={resetButtonStyle} title="Reset to root">
          ↻ Reset
        </button>
      )}
    </nav>
  );
}

/**
 * "bb_b1_8" → "BB Bet 1.8bb"、"bb_x" → "BB Check"、"utg_rAI" → "UTG All-in" 等。
 * 表示には絶対 bb サイズを採用 (pot% はアクションボタン側、ここでは履歴を可読化)。
 */
function formatStep(step: string): string {
  const [actorLc, ...rest] = step.split('_');
  const action = rest.join('_');
  const actor = actorLc.toUpperCase();

  if (action === 'x') return `${actor} Check`;
  if (action === 'c') return `${actor} Call`;
  if (action === 'f') return `${actor} Fold`;
  if (action === 'bAI' || action === 'rAI') return `${actor} All-in`;
  if (action.startsWith('b') || action.startsWith('r')) {
    const verb = action.startsWith('b') ? 'Bet' : 'Raise';
    const size = action.slice(1).replace('_', '.');
    return `${actor} ${verb} ${size}bb`;
  }
  return `${actor} ${action}`;
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const navStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  flexWrap: 'wrap',
  padding: '0.55rem 0.75rem',
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
};

const pairStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
};

const itemStyle: CSSProperties = {
  background: 'transparent',
  color: THEME.textSecondary,
  border: `1px solid transparent`,
  borderRadius: '0.3rem',
  padding: '0.25rem 0.6rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const activeItemStyle: CSSProperties = {
  ...itemStyle,
  background: THEME.cardElevated,
  color: THEME.textPrimary,
  border: `1px solid ${THEME.borderStrong}`,
  fontWeight: 600,
  cursor: 'default',
};

const separatorStyle: CSSProperties = {
  color: THEME.textFaint,
  fontSize: '0.9rem',
  userSelect: 'none',
};

const resetButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  background: 'transparent',
  color: THEME.accent,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  padding: '0.25rem 0.6rem',
  fontSize: '0.78rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
