import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardSet } from './CardSet';
import { getCardSetStyle } from './CardSet.helpers';

describe('getCardSetStyle', () => {
  it('gap がそのまま反映される (3px デフォルト)', () => {
    expect(getCardSetStyle(3).gap).toBe('3px');
    expect(getCardSetStyle(8).gap).toBe('8px');
  });
  it('inline-flex で alignItems=center', () => {
    const s = getCardSetStyle(3);
    expect(s.display).toBe('inline-flex');
    expect(s.alignItems).toBe('center');
  });
});

describe('<CardSet /> rendering', () => {
  it('カード枚数分の <span role="img"> が並ぶ (onCardClick 未指定)', () => {
    const html = renderToStaticMarkup(
      <CardSet
        cards={[
          { rank: 'A', suit: 's' },
          { rank: 'K', suit: 'h' },
          { rank: '3', suit: 'd' },
        ]}
      />,
    );
    // span role="img" 3 つ + 親 1 つ
    expect((html.match(/role="img"/g) ?? []).length).toBe(3);
    expect(html).toContain('>A<');
    expect(html).toContain('>K<');
    expect(html).toContain('>3<');
  });

  it('onCardClick 指定 → 各カードが <button>', () => {
    const html = renderToStaticMarkup(
      <CardSet
        cards={[
          { rank: 'A', suit: 's' },
          { rank: 'K', suit: 'h' },
        ]}
        onCardClick={() => {}}
      />,
    );
    expect((html.match(/<button/g) ?? []).length).toBe(2);
  });

  it('selected/disabled 状態が個別カードに伝播', () => {
    const html = renderToStaticMarkup(
      <CardSet
        cards={[
          { rank: 'A', suit: 's', selected: true },
          { rank: 'K', suit: 'h', disabled: true },
        ]}
        onCardClick={() => {}}
      />,
    );
    // selected → aria-pressed; disabled → disabled attr
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('disabled');
  });

  it('ariaLabel 指定 → 親 span に role=group + aria-label', () => {
    const html = renderToStaticMarkup(
      <CardSet
        cards={[{ rank: 'A', suit: 's' }]}
        ariaLabel="board"
      />,
    );
    expect(html).toMatch(/role="group"[^>]*aria-label="board"|aria-label="board"[^>]*role="group"/);
  });

  it('gap=8 が style に反映', () => {
    const html = renderToStaticMarkup(
      <CardSet
        cards={[{ rank: 'A', suit: 's' }, { rank: 'K', suit: 's' }]}
        gap={8}
      />,
    );
    expect(html).toContain('gap:8px');
  });
});
