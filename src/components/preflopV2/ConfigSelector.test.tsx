import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfigSelector } from './ConfigSelector';
import { findConfig } from '../../data/preflopV2/configs';

describe('ConfigSelector', () => {
  it('renders Open/Rake/Stack with options valid for the current gto config', () => {
    const cfg = findConfig('cash_100bb_6max_nl500_gto')!;
    const html = renderToStaticMarkup(<ConfigSelector current={cfg} />);
    expect(html).toContain('Open');
    expect(html).toContain('GTO');
    expect(html).toContain('2.5x');
    // GTO -> both rakes
    expect(html).toContain('安 (NL50)');
    expect(html).toContain('高 (NL500)');
    // GTO+NL500 -> all 6 stacks as <option>
    for (const s of [20, 50, 75, 100, 150, 200]) {
      expect(html).toContain(`>${s}bb<`);
    }
  });

  it('for the 2.5x config, Stack is restricted to 100bb only', () => {
    const cfg = findConfig('cash_100bb_6max_nl500_2_5x')!;
    const html = renderToStaticMarkup(<ConfigSelector current={cfg} />);
    expect(html).toContain('>100bb<');
    expect(html).not.toContain('>200bb<');
    expect(html).not.toContain('>20bb<');
  });
});
