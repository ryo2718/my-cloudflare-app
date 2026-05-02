import type { CSSProperties } from 'react';
import { useOpenEvaluation } from '../hooks/useOpenEvaluation';
import { THEME } from '../styles/theme';
import type { Hand } from '../types/strategy';
import { StrategyCard } from './StrategyCard';

interface Props {
  hand: Hand | null;
}

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const;

/**
 * 5ポジション (UTG/HJ/CO/BTN/SB) の Open 戦略を3色グラデのカードで表示。
 * - 判定: play率 = raise + call (SB は call 含むため重要)
 * - 背景: raise(赤)/call(緑)/fold(青) の135度グラデ
 */
export function OpenStrategyTable({ hand }: Props) {
  const { evaluations, loading, error } = useOpenEvaluation(hand);

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>Open 戦略{hand ? ` — ${hand}` : ''}</h3>

      {!hand ? (
        <p style={messageStyle}>ハンドを入力してください</p>
      ) : loading && !evaluations ? (
        <p style={messageStyle}>読み込み中…</p>
      ) : error ? (
        <p style={{ ...messageStyle, color: THEME.errorText }}>エラー: {error}</p>
      ) : !evaluations ? null : (
        <>
          <div style={gridStyle}>
            {POSITIONS.map((pos) => {
              const e = evaluations.find((ev) => ev.position === pos);
              if (!e) {
                return (
                  <StrategyCard
                    key={pos}
                    position={pos}
                    raiseRate={0}
                    callRate={0}
                    foldRate={100}
                  />
                );
              }
              return (
                <StrategyCard
                  key={pos}
                  position={pos}
                  raiseRate={e.raiseRate}
                  callRate={e.callRate}
                  foldRate={e.foldRate}
                />
              );
            })}
          </div>
          <Legend />
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

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: '0.5rem',
  marginBottom: '0.75rem',
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
  flexWrap: 'wrap',
  gap: '1rem',
  justifyContent: 'center',
  fontSize: '11px',
  color: THEME.textMuted,
  paddingTop: '0.75rem',
  borderTop: `1px solid ${THEME.border}`,
};
