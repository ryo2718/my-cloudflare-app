// FlopBoard: ボードカードの上のラベルがポット種別ピル (SRP / 3bp) になること (修正2)。

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlopBoard } from './FlopBoard';
import type { Card } from '../../types/card';

const BOARD: Card[] = [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 'd' },
  { rank: '2', suit: 'c' },
];

describe('FlopBoard ポット種別ピル (修正2)', () => {
  it('SRP の問題は「SRP」ピルを出す。「フロップ」ラベルは出さない', () => {
    const html = renderToStaticMarkup(<FlopBoard cards={BOARD} pot="SRP" />);
    expect(html).toContain('SRP');
    expect(html).not.toContain('フロップ');
  });
  it('3bet の問題は「3bp」ピルを出す', () => {
    const html = renderToStaticMarkup(<FlopBoard cards={BOARD} pot="3bet" />);
    expect(html).toContain('3bp');
    expect(html).not.toContain('フロップ');
  });
});
