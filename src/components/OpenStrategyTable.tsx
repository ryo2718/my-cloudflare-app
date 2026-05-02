import type { CSSProperties } from 'react';
import { useOpenEvaluation } from '../hooks/useOpenEvaluation';
import { THEME } from '../styles/theme';
import type { EvaluationSymbol } from '../utils/openEvaluation';
import type { Hand } from '../types/strategy';

interface Props {
  hand: Hand | null;
}

/**
 * 5ポジション (UTG/HJ/CO/BTN/SB) の Open 戦略を、評価記号ごとに色分けされたカードで表示。
 * - 4色: ◎(緑) / ○(橙) / 🔼(青) / ❌(赤)
 * - dark theme 前提で背景は半透明、文字は明色
 * - hand=null / loading / error は シンプルな placeholder
 */
export function OpenStrategyTable({ hand }: Props) {
  const { evaluations, loading, error } = useOpenEvaluation(hand);

  if (!hand) {
    return (
      <div style={containerStyle}>
        <h3 style={titleStyle}>Open 戦略</h3>
        <p style={messageStyle}>ハンドを入力してください</p>
      </div>
    );
  }
  if (loading && !evaluations) {
    return (
      <div style={containerStyle}>
        <h3 style={titleStyle}>Open 戦略 — {hand}</h3>
        <p style={messageStyle}>読み込み中…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div style={containerStyle}>
        <h3 style={titleStyle}>Open 戦略 — {hand}</h3>
        <p style={{ ...messageStyle, color: THEME.errorText }}>エラー: {error}</p>
      </div>
    );
  }
  if (!evaluations) return null;

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>Open 戦略 — {hand}</h3>

      <div style={gridStyle}>
        {evaluations.map((e) => {
          const c = getSymbolStyle(e.symbol);
          return (
            <div
              key={e.position}
              style={{
                border: `2px solid ${c.border}`,
                background: c.background,
                borderRadius: '0.375rem',
                padding: '0.6rem 0.4rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: c.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 500,
                }}
              >
                {e.position}
              </div>
              <div
                style={{
                  fontSize: '28px',
                  lineHeight: 1,
                  color: c.symbol,
                  margin: '0.2rem 0',
                }}
              >
                {e.symbol}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: c.value,
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                }}
              >
                {e.raiseRate.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      <div style={legendStyle}>
        <LegendItem symbol="◎" color={SYMBOL_COLORS['◎'].symbol} text="90%+" />
        <LegendItem symbol="○" color={SYMBOL_COLORS['○'].symbol} text="30-90%" />
        <LegendItem symbol="🔼" color={SYMBOL_COLORS['🔼'].symbol} text="10-30%" />
        <LegendItem symbol="❌" color={SYMBOL_COLORS['❌'].symbol} text="0-10%" />
      </div>
    </div>
  );
}

function LegendItem({ symbol, color, text }: { symbol: string; color: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      <span style={{ color, fontSize: '0.95rem', lineHeight: 1 }}>{symbol}</span>
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Color mapping per evaluation symbol — dark-theme tuned (translucent BG +
// vivid border + lightened foregrounds for readability on THEME.card).
// ---------------------------------------------------------------------------

interface SymbolStyle {
  border: string;
  background: string;
  symbol: string;
  label: string;
  value: string;
}

const SYMBOL_COLORS: Record<EvaluationSymbol, SymbolStyle> = {
  '◎': {
    border: '#16a34a',
    background: 'rgba(22, 163, 74, 0.12)',
    symbol: '#22c55e',
    label: '#4ade80',
    value: '#86efac',
  },
  '○': {
    border: '#ea580c',
    background: 'rgba(234, 88, 12, 0.12)',
    symbol: '#f97316',
    label: '#fb923c',
    value: '#fdba74',
  },
  '🔼': {
    border: '#2563eb',
    background: 'rgba(37, 99, 235, 0.12)',
    symbol: '#3b82f6',
    label: '#60a5fa',
    value: '#93c5fd',
  },
  '❌': {
    border: '#ef4444',
    background: 'rgba(239, 68, 68, 0.12)',
    symbol: '#ef4444',
    label: '#f87171',
    value: '#fca5a5',
  },
};

function getSymbolStyle(symbol: EvaluationSymbol): SymbolStyle {
  return SYMBOL_COLORS[symbol];
}

// ---------------------------------------------------------------------------
// Static styles
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '1rem',
};

const titleStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: THEME.textPrimary,
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  color: THEME.textMuted,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: '0.5rem',
  marginBottom: '0.75rem',
};

const legendStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1rem',
  justifyContent: 'center',
  fontSize: '11px',
  color: THEME.textMuted,
  paddingTop: '0.75rem',
  borderTop: `1px solid ${THEME.border}`,
};
