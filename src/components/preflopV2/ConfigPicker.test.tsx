import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfigPicker } from './ConfigPicker';
import { PREFLOP_V2_CONFIGS } from '../../data/preflopV2/configs';

describe('ConfigPicker', () => {
  it('renders a link for every gto config with the right href and label', () => {
    const html = renderToStaticMarkup(<ConfigPicker />);
    expect(PREFLOP_V2_CONFIGS).toHaveLength(7);
    for (const c of PREFLOP_V2_CONFIGS) {
      expect(html).toContain(`href="/strategy-v2/${c.id}"`);
      expect(html).toContain(c.label);
    }
  });
});
