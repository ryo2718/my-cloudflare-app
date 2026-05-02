import { useState } from 'react';
import { EvRankDisplay } from '../EvRankDisplay';
import { HandInput } from '../HandInput';
import { OpenStrategyTable } from '../OpenStrategyTable';
import { ThreebetStrategyTable } from '../ThreebetStrategyTable';
import type { Hand } from '../../types/strategy';

/**
 * モバイル版 Hand Eval タブ。
 * PC側のコンポーネントを縦積みで再利用 (PC側はコンパクトに自動収縮するので mobile でも収まる)。
 */
export function MobileEvalTab() {
  const [hand, setHand] = useState<Hand | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <HandInput onChange={(notation) => setHand(notation as Hand | null)} />
      <EvRankDisplay hand={hand} />
      <OpenStrategyTable hand={hand} />
      <ThreebetStrategyTable hand={hand} />
    </div>
  );
}
