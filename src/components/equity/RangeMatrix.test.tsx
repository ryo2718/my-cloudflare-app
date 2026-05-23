// @vitest-environment jsdom
// レンジモーダル本体の初期挙動テスト。
// 初期表示で open が選択され、かつ open レンジが「適用・表示」される (ヘッダーの
// コンボ数に反映される) ことを確認する。修正前は open 選択表示でも 0 コンボのままだった。

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/ui';

vi.mock('../../utils/presetRange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/presetRange')>();
  return {
    ...actual,
    fetchPresetRange: vi.fn(async () => new Map([['AsKs', 1], ['AsQs', 1], ['AsJs', 1]])),
  };
});

import { RangeMatrix } from './RangeMatrix';

describe('RangeMatrix', () => {
  it('初期表示で open レンジが適用・表示される (選択表示と実態が一致)', async () => {
    render(
      <RangeMatrix
        initialRange={new Map<string, number>()}
        initialPreset={null}
        board={[]}
        opponentCards={[]}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // open が選択表示
    expect(screen.getByRole('button', { name: 'open' }).getAttribute('aria-pressed')).toBe('true');

    // マウント時に open レンジが適用され、ヘッダーのコンボ数に反映される (0 コンボではない)
    expect(await screen.findByText(/レンジ 3コンボ/)).toBeTruthy();
  });
});
