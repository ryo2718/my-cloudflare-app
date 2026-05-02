import type { Action, Strategy } from '../types/strategy';
import { THEME } from '../styles/theme';
import { RANKS, getHandName } from '../utils/hands';
import { HandCell } from './HandCell';

interface Props {
  strategy: Strategy;
  actions: Action[];
  hoveredHand: string | null;
  onHover: (hand: string | null) => void;
}

export function HandMatrix({ strategy, actions, hoveredHand, onHover }: Props) {
  return (
    <div
      style={{
        background: THEME.card,
        borderRadius: '0.5rem',
        padding: '0.4rem',
        border: '2px solid #000000',
        maxWidth: '520px',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(13, 1fr)',
          gap: 0,
          // 各セルが border:1px solid #000、gap:0 — 隣接セル境界は 2pxに見えるが、
          // 黒明確で目的(セル区切り曖昧の解消)を満たす。container 自身も 2px 黒で seal。
        }}
      >
        {RANKS.map((_, row) =>
          RANKS.map((_, col) => {
            const hand = getHandName(row, col);
            const freqs = (strategy as Record<string, number[]>)[hand];
            if (!freqs) {
              // 空セルも cellEmpty で塗って、黒境界の中で識別可能にする
              return (
                <div
                  key={`${row}-${col}`}
                  style={{
                    background: THEME.cellEmpty,
                    border: '1px solid #000000',
                    aspectRatio: '1',
                  }}
                />
              );
            }
            return (
              <HandCell
                key={`${row}-${col}`}
                hand={hand}
                frequencies={freqs}
                actions={actions}
                hovered={hoveredHand === hand}
                onHover={onHover}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
