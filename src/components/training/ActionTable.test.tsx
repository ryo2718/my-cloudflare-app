// @vitest-environment jsdom
// instantLeadingFolds: 先頭の fold (オープン前に降りた席) は待たずに即表示し、
// オープン以降だけアニメで順次表示する。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '../../test/ui';
import { ActionTable } from './ActionTable';
import type { ActionItem } from '../../data/training/actionHistory';
import { getActionDelay } from '../../data/training/actionHistory';

// BTN vs BB: UTG/HJ/CO fold (オープン前) → BTN raise (オープン) → SB fold → BB call
const ITEMS: ActionItem[] = [
  { position: 'UTG', kind: 'fold' },
  { position: 'HJ', kind: 'fold' },
  { position: 'CO', kind: 'fold' },
  { position: 'BTN', kind: 'raise', amount: 2.5 },
  { position: 'SB', kind: 'fold' },
  { position: 'BB', kind: 'call' },
];

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ActionTable instantLeadingFolds', () => {
  it('先頭 fold (UTG/HJ/CO) を即表示し、オープン (BTN raise) はアニメまで出さない', () => {
    const { container } = render(
      <ActionTable mePosition="BTN" items={ITEMS} animate instantLeadingFolds onAnimationDone={() => {}} />,
    );
    const html0 = container.innerHTML;
    // オープン前の fold は最初から表示 (ポップアップ aria-label "POS fold")
    expect(html0).toContain('UTG fold');
    expect(html0).toContain('HJ fold');
    expect(html0).toContain('CO fold');
    // オープン (BTN raise) はまだアニメ前なので出ていない
    expect(html0).not.toContain('BTN raise');
    // 1ステップ進めるとオープンが出る
    act(() => {
      vi.advanceTimersByTime(getActionDelay('raise') + 10);
    });
    expect(container.innerHTML).toContain('BTN raise');
  });

  it('instantLeadingFolds 未指定なら先頭からアニメ (オープン前 fold も最初は出ない)', () => {
    const { container } = render(
      <ActionTable mePosition="BTN" items={ITEMS} animate onAnimationDone={() => {}} />,
    );
    // 従来どおり: 最初は何の fold ポップアップも出ていない
    expect(container.innerHTML).not.toContain('UTG fold');
  });
});
