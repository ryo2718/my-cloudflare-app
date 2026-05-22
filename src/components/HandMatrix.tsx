import type { Action, Strategy } from '../types/strategy';
import { THEME } from '../styles/theme';
import { HandGrid } from './HandGrid';
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
      {/* 各セルが border:1px solid #000、gap:0 — 隣接セル境界は 2px に見えるが目的を満たす。 */}
      <HandGrid
        gridStyle={{ gap: 0 }}
        renderCell={(hand) => {
          const freqs = (strategy as Record<string, number[]>)[hand];
          // 親ノードに含まれないハンド (= sparse strategy で key 未定義) は空セル。
          // key が存在するハンドは GTO レンジ内なので、 fold 100% でも色塗り (青) する。
          const isUnreachable = !freqs || freqs.length === 0;
          if (isUnreachable) {
            return <div style={{ background: THEME.cellEmpty, border: '1px solid #000000', aspectRatio: '1' }} />;
          }
          return (
            <HandCell
              hand={hand}
              frequencies={freqs}
              actions={actions}
              hovered={hoveredHand === hand}
              onHover={onHover}
            />
          );
        }}
      />
    </div>
  );
}
