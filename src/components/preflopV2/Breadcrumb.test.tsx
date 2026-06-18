import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb (pills)', () => {
  it('skips the leading folds and shows opener -> 3bet pills with navigation', () => {
    // F-F-R2.5-R12: UTG fold, HJ fold, CO open, BTN 3bet
    const html = renderToStaticMarkup(<Breadcrumb config="c" chain="F-F-R2.5-R12" />);
    expect(html).toContain('CO');
    expect(html).toContain('open');
    expect(html).toContain('BTN');
    expect(html).toContain('3bet');
    // leading UTG/HJ folds are omitted
    expect(html).not.toContain('UTG');
    expect(html).not.toContain('HJ');
    // current (last) pill is emphasised with a border; earlier pills are not
    expect(html).toContain('border:2px solid transparent'); // CO open (not current)
    expect(html).toMatch(/border:2px solid rgb\(/); // BTN 3bet (current) darkened border
  });

  it('shows a root label when the chain is all folds / empty', () => {
    expect(renderToStaticMarkup(<Breadcrumb config="c" chain="" />)).toContain('Root');
  });
});
