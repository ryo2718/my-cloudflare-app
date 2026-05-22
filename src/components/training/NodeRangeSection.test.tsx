// @vitest-environment jsdom
// フェーズ4: ハンドグリッド (NodeRangeSection) が通常ノード / limp・check ノードの
// 両方で正しく描画されること (過去に limp/check で描画が壊れた前例があるため)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { NodeRangeSection } from './NodeRangeSection';

function stubFetchHands(hands: Record<string, Record<string, number>>) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hands }) }) as unknown as Response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NodeRangeSection ハンドグリッド (UI)', () => {
  beforeEach(() => {
    // 各テストで fetch を上書き
  });

  it('通常ノード: 169 セル + 凡例「コール」、出題ハンドの頻度バーを表示', async () => {
    stubFetchHands({
      AA: { allin: 0, raise: 100, call: 0, fold: 0 },
      KK: { allin: 0, raise: 0, call: 100, fold: 0 },
      '72o': { allin: 0, raise: 0, call: 0, fold: 100 },
    });
    const { container } = render(<NodeRangeSection file="utg.json" highlightHand="AA" />);

    // グリッド (169 セル) が出る。タップ可能なのでセルは role="button"。
    await screen.findByText('オールイン'); // 凡例
    expect(container.querySelectorAll('[role="button"]').length).toBe(169);
    // 通常ノードは緑凡例が「コール」(凡例+頻度バーで複数可)、「チェック」は出ない
    expect(screen.getAllByText('コール').length).toBeGreaterThan(0);
    expect(screen.queryByText('チェック')).toBeNull();
    // 出題ハンド AA の頻度バー (raise 100%)
    expect(screen.getAllByText('レイズ').length).toBeGreaterThan(0);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('limp/check ノード: 凡例が「チェック」、check セルが緑、頻度バーに「チェック」', async () => {
    stubFetchHands({
      AA: { allin: 0, raise: 100, call: 0, check: 0, fold: 0 },
      '72o': { allin: 0, raise: 0, call: 0, check: 100, fold: 0 },
      J5o: { allin: 0, raise: 40.5, call: 0, check: 59.5, fold: 0 },
    });
    const { container } = render(<NodeRangeSection file="sbc_bb.json" highlightHand="J5o" />);

    await screen.findByText('オールイン');
    // check があるノードは緑凡例が「チェック」(「コール」は出ない)。凡例+頻度バーで複数可。
    expect(screen.getAllByText('チェック').length).toBeGreaterThan(0);
    expect(screen.queryByText('コール')).toBeNull();
    // グリッドが 169 セル描画される (check セルが緑 = call と同色なのは helpers テストで担保)。
    expect(container.querySelectorAll('[role="button"]').length).toBe(169);
  });

  it('セルタップで別ハンドの頻度内訳に切り替わる', async () => {
    stubFetchHands({
      AA: { allin: 0, raise: 100, call: 0, fold: 0 },
      '72o': { allin: 0, raise: 0, call: 0, fold: 100 },
    });
    const user = userEvent.setup();
    render(<NodeRangeSection file="utg.json" highlightHand="AA" />);
    await screen.findByText('オールイン');

    // 72o セルをタップ → 72o の頻度 (フォールド 100%) に切替
    const cell = screen.getByRole('button', { name: '72o' });
    await user.click(cell);
    expect(screen.getAllByText('フォールド').length).toBeGreaterThan(0);
  });
});
