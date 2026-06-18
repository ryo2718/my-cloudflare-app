import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AggregateReport } from '../AggregateReport';
import { PREFLOP_V2_ACTIONS } from '../../data/preflopV2/strategy';
import type { Strategy } from '../../types/strategy';

// Phase 2d: aggregate バーは既存 AggregateReport を流用 (新規コンポーネントを作らない)。
// 集計はコンボ加重平均: %_action = Σ(combos*freq) / Σ(combos) * 100。
describe('Aggregate bar (reused AggregateReport, combo-weighted)', () => {
  it('weights by combos: AA(6) all-raise + 72o(12) all-fold -> 33.3% raise / 66.7% fold', () => {
    // PREFLOP_V2_ACTIONS order = [fold, call, raise, allin]
    const strategy: Strategy = {
      AA: [0, 0, 1, 0],
      '72o': [1, 0, 0, 0],
    };
    const html = renderToStaticMarkup(
      <AggregateReport strategy={strategy} actions={[...PREFLOP_V2_ACTIONS]} />,
    );
    expect(html).toContain('66.7%'); // fold (12 combos)
    expect(html).toContain('33.3%'); // raise (6 combos)
    // colors come from the unified action palette
    expect(html.toUpperCase()).toContain('2F7BC4'); // fold blue
    expect(html.toUpperCase()).toContain('D8443C'); // raise red
  });
});
