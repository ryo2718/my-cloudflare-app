import { useMemo } from 'react';
import type { Action, Strategy } from '../types/strategy';
import { THEME } from '../styles/theme';
import { getCombos } from '../utils/hands';

interface Props {
  strategy: Strategy;
  actions: Action[];
}

export function AggregateReport({ strategy, actions }: Props) {
  const totalEntries = Object.keys(strategy).length;

  const aggregates = useMemo(() => {
    const totalCombos = Object.keys(strategy).reduce((sum, hand) => sum + getCombos(hand), 0);
    const actionTotals = actions.map(() => 0);

    Object.entries(strategy).forEach(([hand, freqs]) => {
      if (!freqs) return;
      const combos = getCombos(hand);
      freqs.forEach((freq, i) => {
        actionTotals[i] += combos * freq;
      });
    });

    return actionTotals.map((t) => (totalCombos === 0 ? 0 : (t / totalCombos) * 100));
  }, [strategy, actions]);

  if (totalEntries === 0) {
    return (
      <div
        style={{
          background: THEME.card,
          borderRadius: '0.5rem',
          padding: '0.85rem',
          border: `1px solid ${THEME.border}`,
          maxWidth: '520px',
          width: '100%',
          color: THEME.textMuted,
          fontSize: '0.78rem',
          textAlign: 'center',
        }}
      >
        このノードに戦略的に到達するハンドはありません
      </div>
    );
  }

  return (
    <div
      style={{
        background: THEME.card,
        borderRadius: '0.5rem',
        padding: '0.85rem',
        border: `1px solid ${THEME.border}`,
        maxWidth: '520px',
        width: '100%',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: '0.7rem',
          color: THEME.textSecondary,
          marginBottom: '0.5rem',
          fontWeight: 500,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Aggregate
      </h3>

      <div
        style={{
          display: 'flex',
          height: '1.75rem',
          borderRadius: '0.25rem',
          overflow: 'hidden',
          marginBottom: '0.5rem',
        }}
      >
        {aggregates.map((pct, i) =>
          pct > 0 ? (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                background: actions[i].color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: THEME.textPrimary,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              {pct >= 8 && `${pct.toFixed(1)}%`}
            </div>
          ) : null,
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        {actions.map((action, i) => (
          <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div
              style={{
                width: '0.75rem',
                height: '0.75rem',
                background: action.color,
                borderRadius: '0.125rem',
              }}
            />
            <span style={{ fontSize: '0.78rem', color: THEME.textSecondary }}>
              {action.label}:{' '}
              <strong style={{ color: THEME.textPrimary }}>{aggregates[i].toFixed(1)}%</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
