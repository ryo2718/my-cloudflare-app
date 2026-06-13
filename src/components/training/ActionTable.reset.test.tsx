// @vitest-environment jsdom
// 問題切替 (source = file / mePosition / providedItems の変化) で items/revealed を
// レンダー中にリセットし、前 source の表示を残さず最初から再生することを確認する。
//
// 注: 前 source の「1フレーム残留」自体は commit〜effect フラッシュ間の挙動で、
// testing-library は act() 内で effect を同期フラッシュするため直接は観測できない。
// ここでは「source 切替後は前 source のポップアップが残らず、新 source は
// revealed=0 から再生される」という到達状態をガードする。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '../../test/ui';
import { ActionTable } from './ActionTable';
import type { ActionItem } from '../../data/training/actionHistory';
import { getActionDelay } from '../../data/training/actionHistory';

const ITEMS_A: ActionItem[] = [{ position: 'BTN', kind: 'raise', amount: 2.5 }];
const ITEMS_B: ActionItem[] = [{ position: 'CO', kind: 'raise', amount: 3 }];

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ActionTable source 切替リセット', () => {
  it('providedItems を切り替えると前 source の表示を残さず、新 source を最初から再生する', () => {
    const { container, rerender } = render(
      <ActionTable mePosition="BTN" items={ITEMS_A} animate onAnimationDone={() => {}} />,
    );
    // A を再生 → BTN raise が表示される
    act(() => {
      vi.advanceTimersByTime(getActionDelay('raise') + 10);
    });
    expect(container.innerHTML).toContain('BTN raise');

    // 別 source (B) へ切替: 前 source の BTN raise は残らず、新 source も未再生
    rerender(<ActionTable mePosition="BTN" items={ITEMS_B} animate onAnimationDone={() => {}} />);
    expect(container.innerHTML).not.toContain('BTN raise');
    expect(container.innerHTML).not.toContain('CO raise');

    // タイマーを進めると新 source (B) が出る
    act(() => {
      vi.advanceTimersByTime(getActionDelay('raise') + 10);
    });
    expect(container.innerHTML).toContain('CO raise');
  });
});
