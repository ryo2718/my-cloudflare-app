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
            // 親ノードに含まれないハンド (= sparse strategy で key 未定義) は空表示。
            // 加えて、データが non-sparse で「全 action 0% (=本来は来てない)」「fold 100%」のハンドを
            // 含めて返してくる場合の防御: play 系 (allin/raise/call) の合計が 0 ならスキップ。
            // これにより「前ノードに来ないはずのハンドが青で塗られる」バグを回避する。
            const isUnreachable =
              !freqs ||
              freqs.length === 0 ||
              actions.reduce((sum, a, i) => {
                const f = freqs[i] ?? 0;
                return a.id === 'fold' ? sum : sum + f;
              }, 0) <= 0;
            if (isUnreachable) {
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
