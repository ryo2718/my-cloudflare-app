// FlopBoard: ボードカードの上のラベルがポット種別ピル (SRP / 3bp) になること (修正2)。

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlopBoard } from './FlopBoard';
import { potPillColor } from './flopFeedbackFormat';
import { ACTION_COLOR } from '../../styles/actionColors';
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
  it('SRP ピルはクリーム / 3bp ピルは赤系オレンジ。紫・緑は使わない', () => {
    const srp = renderToStaticMarkup(<FlopBoard cards={BOARD} pot="SRP" />);
    expect(srp).toContain(potPillColor('SRP').bg); // クリーム #FAC775
    const threeb = renderToStaticMarkup(<FlopBoard cards={BOARD} pot="3bet" />);
    expect(threeb).toContain(potPillColor('3bet').bg); // 赤系オレンジ #DD5A2E
    // 紫 (オールイン/ポットオーバー専用) と 緑 (check/テーブル) は使わない
    for (const html of [srp, threeb]) {
      expect(html).not.toContain(ACTION_COLOR.allin); // 紫 #534AB7
      expect(html).not.toContain(ACTION_COLOR.check); // 緑 #3B8A1E
    }
  });
});
