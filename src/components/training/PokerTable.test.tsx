import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PokerTable } from './PokerTable';

describe('PokerTable チップ色', () => {
  it("variant='allin' (5bet ジャム) は黒背景・白文字", () => {
    const html = renderToStaticMarkup(
      <PokerTable
        mePosition="UTG"
        opener="UTG"
        chipExtras={[
          { position: 'UTG', amount: 30 },
          { position: 'HJ', amount: 100, variant: 'allin' },
        ]}
      />,
    );
    // 黒チップ (5bet) の背景・文字色
    expect(html).toContain('background:#2C2C2A');
    expect(html).toContain('100');
  });

  it('通常の高額チップ (4bet 30) は緑のまま (黒化しない)', () => {
    const html = renderToStaticMarkup(
      <PokerTable mePosition="UTG" opener="UTG" chipExtras={[{ position: 'HJ', amount: 30 }]} />,
    );
    expect(html).toContain('#C0DD97'); // 緑チップの枠線色
    expect(html).not.toContain('#2C2C2A');
  });
});
