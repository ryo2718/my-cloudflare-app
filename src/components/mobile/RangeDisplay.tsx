import { useMemo } from 'react';
import { AggregateReport } from '../AggregateReport';
import { HandMatrix } from '../HandMatrix';
import { getNodeScenario } from '../../data/scenarios';
import { useStrategy } from '../../hooks/useStrategy';
import { heroFromPath, type Position } from '../../types/mobile';

interface Props {
  /** 表示する preflop node_path。null/空文字なら placeholder */
  nodePath: string | null;
  /** state.opener — 色判定 (現 hero === opener なら青枠、!== なら赤枠) */
  opener: Position | null;
}

/**
 * モバイル用レンジ表示。
 *  - PC版 useStrategy で fetch (キャッシュ共有)
 *  - PC版 HandMatrix を流用 (hover は no-op)
 *  - PC版 AggregateReport を流用
 *  - 全体を「actor color」(青/赤) のカードで囲む
 */
export function RangeDisplay({ nodePath, opener }: Props) {
  const scenario = useMemo(() => (nodePath ? getNodeScenario(nodePath) : null), [nodePath]);
  const { data, loading, error } = useStrategy(scenario);

  if (!nodePath || !opener) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '2rem 0',
          color: '#b0a18e',
          fontSize: '13px',
        }}
      >
        ポジションを選択してください
      </div>
    );
  }

  const currentHero = heroFromPath(nodePath);
  const isOpenerHero = currentHero === opener;
  const borderColor = isOpenerHero ? '#93c5fd' : '#fca5a5';
  const accent = isOpenerHero ? '#1e40af' : '#b91c1c';

  return (
    <div
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '10px',
        marginBottom: '0.75rem',
        background: '#fefdf9',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: accent,
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 500,
        }}
      >
        {currentHero} range
      </div>

      {loading && !data ? (
        <Placeholder>Loading…</Placeholder>
      ) : error ? (
        <Placeholder color="#b91c1c">データが見つかりません: {error.message}</Placeholder>
      ) : data ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <HandMatrix
              strategy={data.strategy}
              actions={data.actions}
              hoveredHand={null}
              onHover={noopHover}
            />
          </div>
          <AggregateReport strategy={data.strategy} actions={data.actions} />
        </>
      ) : null}
    </div>
  );
}

function Placeholder({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        padding: '1.25rem',
        textAlign: 'center',
        color: color ?? '#8c7d6a',
        fontSize: '13px',
      }}
    >
      {children}
    </div>
  );
}

const noopHover = (_hand: string | null) => {
  /* mobile: hover無効 */
};
