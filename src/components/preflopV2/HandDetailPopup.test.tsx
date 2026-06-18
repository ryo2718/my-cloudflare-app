import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandDetailPopup } from './HandDetailPopup';
import { PREFLOP_V2_MATRIX_ACTIONS } from '../../data/preflopV2/strategy';

describe('HandDetailPopup', () => {
  it('shows the hand name and each action percentage', () => {
    // order = [fold, call, raise, allin]
    const html = renderToStaticMarkup(
      <HandDetailPopup hand="AKs" frequencies={[0.05, 0.25, 0.7, 0]} actions={PREFLOP_V2_MATRIX_ACTIONS} onClose={() => {}} />,
    );
    expect(html).toContain('AKs');
    expect(html).toContain('70.0%'); // raise
    expect(html).toContain('25.0%'); // call
    expect(html).toContain('5.0%'); // fold
  });
});
