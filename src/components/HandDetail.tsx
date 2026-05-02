import type { Action, Strategy } from '../types/strategy';
import { THEME } from '../styles/theme';
import { getCombos } from '../utils/hands';

interface Props {
  hand: string | null;
  strategy: Strategy | null;
  actions: Action[];
  /** どちら側 (例: "UTG Open" / "BB vs UTG") から hover されたかを示すラベル */
  sideLabel?: string;
}

export function HandDetail({ hand, strategy, actions, sideLabel }: Props) {
  const freqs = hand && strategy ? (strategy as Record<string, number[]>)[hand] : undefined;

  if (!hand || !freqs) {
    return (
      <div
        style={{
          background: THEME.card,
          borderRadius: '0.5rem',
          padding: '1rem',
          border: `1px solid ${THEME.border}`,
          minHeight: '6rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: THEME.textMuted,
          fontSize: '0.875rem',
        }}
      >
        ハンドにマウスを乗せて詳細表示
      </div>
    );
  }

  const combos = getCombos(hand);

  return (
    <div
      style={{
        background: THEME.card,
        borderRadius: '0.5rem',
        padding: '1rem',
        border: `1px solid ${THEME.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1.5rem',
            color: THEME.textPrimary,
            fontWeight: 700,
            fontFamily: 'monospace',
          }}
        >
          {hand}
        </h3>
        <span style={{ fontSize: '0.75rem', color: THEME.textMuted }}>{combos} combos</span>
        {sideLabel && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.78rem',
              color: THEME.accentHover,
              padding: '0.25rem 0.7rem',
              background: THEME.cardElevated,
              border: `1px solid ${THEME.border}`,
              borderRadius: '0.3rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            {sideLabel}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {actions.map((action, i) =>
          freqs[i] > 0 ? (
            <div
              key={action.id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <div
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  background: action.color,
                  borderRadius: '0.125rem',
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: '0.875rem', color: THEME.textSecondary, minWidth: '6rem' }}
              >
                {action.label}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '0.5rem',
                  background: THEME.cardElevated,
                  borderRadius: '0.25rem',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${freqs[i] * 100}%`,
                    height: '100%',
                    background: action.color,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '0.875rem',
                  color: THEME.textPrimary,
                  fontWeight: 600,
                  minWidth: '3rem',
                  textAlign: 'right',
                }}
              >
                {(freqs[i] * 100).toFixed(1)}%
              </span>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
