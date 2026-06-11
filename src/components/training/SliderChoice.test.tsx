// @vitest-environment jsdom
// SliderChoice: 100%ショートカット (即セット+自動送信) と、従来の手動操作+送信の回帰。

import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { SliderChoice } from './SliderChoice';

describe('SliderChoice ショートカットボタン', () => {
  it('「100%レイズ」「100%フォールド」ボタンが表示される', () => {
    render(<SliderChoice actionLabel="レイズ" onSubmit={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: '100%レイズ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '100%フォールド' })).toBeTruthy();
  });

  it('100%レイズ押下で onSubmit(100) が即呼ばれる (自動送信)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SliderChoice actionLabel="レイズ" onSubmit={onSubmit} onSkip={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '100%レイズ' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(100);
  });

  it('100%フォールド押下で onSubmit(0) が即呼ばれる (自動送信)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SliderChoice actionLabel="レイズ" onSubmit={onSubmit} onSkip={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '100%フォールド' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(0);
  });

  it('actionLabel は高ボタンに反映 (コール等)', () => {
    render(<SliderChoice actionLabel="コール" onSubmit={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: '100%コール' })).toBeTruthy();
  });

  it('従来の「回答する」(既定値50) と「この問題を飛ばす」は引き続き動作 (回帰)', async () => {
    const onSubmit = vi.fn();
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<SliderChoice actionLabel="レイズ" onSubmit={onSubmit} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: '回答する' }));
    expect(onSubmit).toHaveBeenCalledWith(50); // 既定スライダー値
    await user.click(screen.getByRole('button', { name: 'この問題を飛ばす' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('disabled 時はショートカットも無効', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SliderChoice actionLabel="レイズ" onSubmit={onSubmit} onSkip={vi.fn()} disabled />);
    await user.click(screen.getByRole('button', { name: '100%レイズ' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
