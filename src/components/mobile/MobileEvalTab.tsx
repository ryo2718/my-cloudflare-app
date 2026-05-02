import { useState } from 'react';
import { EvRankDisplay } from '../EvRankDisplay';
import { OpenStrategyTable } from '../OpenStrategyTable';
import { ThreebetStrategyTable } from '../ThreebetStrategyTable';
import type { Hand } from '../../types/strategy';
import { MobileHandInput } from './MobileHandInput';

/**
 * モバイル版 Hand Eval タブ。
 * 入力だけ MobileHandInput (7+6 行レイアウト、スートボタン廃止)。
 * 評価系 (EvRankDisplay / OpenStrategyTable / ThreebetStrategyTable) は PC側を再利用。
 */
export function MobileEvalTab() {
  const [hand, setHand] = useState<Hand | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <MobileHandInput onChange={(notation) => setHand(notation as Hand | null)} />
      <EvRankDisplay hand={hand} />
      <OpenStrategyTable hand={hand} />
      <ThreebetStrategyTable hand={hand} />
    </div>
  );
}
