// @vitest-environment jsdom
// プリセットレンジ選択 (ポジション/アクション) の挙動テスト。
//   - 初期マウントで open が選択され、その open レンジが適用される
//   - ポジション変更で open に追従し、新ポジションの open レンジが適用される
//   - アクション (vs 3bet 等) を選ぶとそのアクションに切り替わる
// fetchPresetRange のみモックし、ノード存在判定 (実 AVAILABLE_NODE_PATHS) は実物を使う。

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, userEvent } from '../../test/ui';

vi.mock('../../utils/presetRange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/presetRange')>();
  return {
    ...actual,
    fetchPresetRange: vi.fn(async (path: string) => new Map([[path, 1]])),
  };
});

import { PresetRangePicker } from './PresetRangePicker';

describe('PresetRangePicker', () => {
  it('初期状態: open が選択され、open レンジが適用される', async () => {
    const onApply = vi.fn();
    render(<PresetRangePicker onApply={onApply} />);

    // open ボタンは選択表示 (オレンジ)
    expect(screen.getByRole('button', { name: 'open' }).getAttribute('aria-pressed')).toBe('true');

    // マウント時に open レンジが実際に適用される (選択表示と実態が一致)
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    const [range, info] = onApply.mock.calls[0];
    expect(info).toEqual({ position: 'UTG', scenario: 'open', vsPosition: null });
    expect(range.size).toBeGreaterThan(0);
  });

  it('ポジション変更時: open に追従し新ポジションの open レンジが適用される', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<PresetRangePicker onApply={onApply} />);
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));

    // ポジションを CO に変更 (open ボタンは押さない)
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'CO');

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
    const [, info] = onApply.mock.calls[1];
    expect(info).toEqual({ position: 'CO', scenario: 'open', vsPosition: null });
    expect(screen.getByRole('button', { name: 'open' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('アクション変更時: vs 3bet を選ぶとそのアクションに切り替わる', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<PresetRangePicker onApply={onApply} />);
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'vs 3bet' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
    const [, info] = onApply.mock.calls[1];
    expect(info.scenario).toBe('vs3bet');
    expect(screen.getByRole('button', { name: 'vs 3bet' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'open' }).getAttribute('aria-pressed')).toBe('false');
  });
});
