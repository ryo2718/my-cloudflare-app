import { useState, type CSSProperties } from 'react';
import {
  use3betEvaluation,
  type VsPosition,
} from '../hooks/use3betEvaluation';
import { THEME } from '../styles/theme';
import { StrategyCard } from './StrategyCard';

interface Props {
  hand: string | null;
}

const VS_POSITIONS: ReadonlyArray<VsPosition> = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

/**
 * 3bet 戦略を vs ポジション別タブで表示。
 * - StrategyCard を使った3色グラデ表示
 * - hero ポジション数は 5/4/3/2/1 で可変
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
              <StrategyCard
                key={e.position}
                position={e.position}
                raiseRate={e.raiseRate}
                callRate={e.callRate}
                foldRate={e.foldRate}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
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

