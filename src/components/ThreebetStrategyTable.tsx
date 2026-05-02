import { useState, type CSSProperties } from 'react';
import {
  use3betEvaluation,
  type Symbol as EvalSymbol,
  type ThreebetEvaluation,
  type VsPosition,
} from '../hooks/use3betEvaluation';
import { THEME } from '../styles/theme';

interface Props {
  hand: string | null;
}

const VS_POSITIONS: ReadonlyArray<VsPosition> = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

/**
 * 3bet 戦略を vs ポジション別タブで表示。
 * - hand=null: プレースホルダ
 * - 各タブ: その vs ポジションに対する hero ポジション群 (5/4/3/2/1 カード)
 * - 各カード: ◎○🔼❌記号 + R(raise%) + C(call%)
 */
export function ThreebetStrategyTable({ hand }: Props) {
  const [activeVs, setActiveVs] = useState<VsPosition>('UTG');
  const { evaluations, loading, error } = use3betEvaluation(hand, activeVs);

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>3bet 戦略{hand ? ` — ${hand}` : ''}</h3>

      {/* vs ポジションタブ */}
      <div style={tabsContainerStyle}>
        {VS_POSITIONS.map((vs) => {
          const isActive = activeVs === vs;
          return (
            <button
              key={vs}
              type="button"
              onClick={() => setActiveVs(vs)}
              style={{
                ...tabButtonStyle,
                color: isActive ? THEME.textPrimary : THEME.textMuted,
                borderBottomColor: isActive ? '#3b82f6' : 'transparent',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              vs {vs}
            </button>
          );
        })}
      </div>

      {/* 結果表示 */}
      {!hand ? (
        <p style={messageStyle}>ハンドを入力してください</p>
      ) : loading && !evaluations ? (
        <p style={messageStyle}>読み込み中…</p>
      ) : error ? (
        <p style={{ ...messageStyle, color: THEME.errorText }}>エラー: {error}</p>
      ) : !evaluations ? null : (
        <>
          <div style={getGridStyle(evaluations.length)}>
            {evaluations.map((e) => (
              <EvalCard key={e.position} evaluation={e} />
            ))}
          </div>

          <div style={legendStyle}>
            <LegendItem color="#22c55e" symbol="◎" text="play 90%+" />
            <LegendItem color="#f97316" symbol="○" text="30-90%" />
            <LegendItem color="#3b82f6" symbol="🔼" text="10-30%" />
            <LegendItem color="#ef4444" symbol="❌" text="0-10%" />
          </div>
          <p style={noteStyle}>
            ※ play率 = raise + call。R = raise率、C = call率。
          </p>
        </>
      )}
    </div>
  );
}

function LegendItem({ color, symbol, text }: { color: string; symbol: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      <span style={{ color, fontSize: '0.95rem', lineHeight: 1 }}>{symbol}</span>
      {text}
    </span>
  );
}

function EvalCard({ evaluation }: { evaluation: ThreebetEvaluation }) {
  const c = getSymbolStyle(evaluation.symbol);
  return (
    <div
      style={{
        border: `2px solid ${c.border}`,
        background: c.background,
        borderRadius: '0.375rem',
        padding: '0.6rem 0.4rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: c.label,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 500,
          marginBottom: '0.4rem',
        }}
      >
        {evaluation.position}
      </div>
      <div style={{ fontSize: '24px', lineHeight: 1, color: c.symbol, margin: '0.4rem 0' }}>
        {evaluation.symbol}
      </div>
      <div
        style={{
          fontSize: '10px',
          color: c.value,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          lineHeight: 1.4,
        }}
      >
        <div>R: {evaluation.raiseRate.toFixed(0)}%</div>
        <div>C: {evaluation.callRate.toFixed(0)}%</div>
      </div>
    </div>
  );
}

// OpenStrategyTable と同じカラーパレット (ダークテーマ向け)。
// 既存ファイルを触らないため、ここで再定義 (将来統合する場合は shared util に移す)。
interface SymbolStyle {
  border: string; background: string; symbol: string; label: string; value: string;
}
function getSymbolStyle(symbol: EvalSymbol): SymbolStyle {
  switch (symbol) {
    case '◎': return { border: '#16a34a', background: 'rgba(22, 163, 74, 0.12)',  symbol: '#22c55e', label: '#4ade80', value: '#86efac' };
    case '○': return { border: '#ea580c', background: 'rgba(234, 88, 12, 0.12)',  symbol: '#f97316', label: '#fb923c', value: '#fdba74' };
    case '🔼': return { border: '#2563eb', background: 'rgba(37, 99, 235, 0.12)',  symbol: '#3b82f6', label: '#60a5fa', value: '#93c5fd' };
    case '❌': return { border: '#ef4444', background: 'rgba(239, 68, 68, 0.12)',  symbol: '#ef4444', label: '#f87171', value: '#fca5a5' };
  }
}

function getGridStyle(count: number): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    gap: '0.5rem',
  };
}

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

const tabsContainerStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  borderBottom: `1px solid ${THEME.border}`,
  marginBottom: '1rem',
  overflowX: 'auto',
};

const tabButtonStyle: CSSProperties = {
  padding: '0.5rem 0.75rem',
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  fontSize: '0.85rem',
  cursor: 'pointer',
  transition: 'color 0.15s, border-color 0.15s',
  whiteSpace: 'nowrap',
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  color: THEME.textMuted,
  textAlign: 'center',
  padding: '1rem',
};

const legendStyle: CSSProperties = {
  display: 'flex',
  gap: '1rem',
  justifyContent: 'center',
  fontSize: '11px',
  color: THEME.textMuted,
  paddingTop: '0.75rem',
  borderTop: `1px solid ${THEME.border}`,
  marginTop: '0.75rem',
  flexWrap: 'wrap',
};

const noteStyle: CSSProperties = {
  margin: '0.5rem 0 0',
  fontSize: '0.7rem',
  color: THEME.textMuted,
  textAlign: 'center',
  fontStyle: 'italic',
};
