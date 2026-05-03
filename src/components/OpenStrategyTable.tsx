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
        </>
      )}
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

