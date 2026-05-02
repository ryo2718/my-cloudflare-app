import { useState, type CSSProperties } from 'react';
import {
  use4betEvaluation,
  type VsPosition,
} from '../hooks/use4betEvaluation';
import { THEME } from '../styles/theme';
import { StrategyCard } from './StrategyCard';

interface Props {
  hand: string | null;
}

const VS_POSITIONS: ReadonlyArray<VsPosition> = ['HJ', 'CO', 'BTN', 'SB', 'BB'];

/**
 * 4bet 戦略を vs (= 3bettor) ポジション別タブで表示。
 * - StrategyCard を使った3色グラデ表示 (3bet戦略と同じ規則)
 * - hero (= 元 opener) ポジション数は 1/2/3/4/5 で可変
 */
export function FourbetStrategyTable({ hand }: Props) {
  const [activeVs, setActiveVs] = useState<VsPosition>('HJ');
  const { evaluations, loading, error } = use4betEvaluation(hand, activeVs);

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>4bet 戦略{hand ? ` — ${hand}` : ''}</h3>

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
                allinRate={e.allinRate}
                foldRate={e.foldRate}
              />
            ))}
          </div>
          <Legend />
          <p style={noteStyle}>
            ※ play率 = AI + raise + call。AI = all-in 率 (紫)、R = raise率、C = call率。
          </p>
        </>
      )}
    </div>
  );
}

function Legend() {
  const items: ReadonlyArray<{ symbol: string; color: string; text: string }> = [
    { symbol: '◎', color: '#ef4444', text: 'play 90%+' },
    { symbol: '○', color: '#ea580c', text: '30-90%' },
    { symbol: '△', color: '#a16207', text: '10-30%' },
    { symbol: '✕', color: '#3b82f6', text: '0-10%' },
  ];
  return (
    <div style={legendStyle}>
      {items.map((it) => (
        <span key={it.symbol} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ color: it.color, fontSize: '0.95rem', lineHeight: 1 }}>{it.symbol}</span>
          {it.text}
        </span>
      ))}
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
