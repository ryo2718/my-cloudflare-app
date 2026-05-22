// @vitest-environment jsdom
// フェーズ1: UIテスト基盤 (jsdom + testing-library) が機能することの確認。

import { describe, it, expect } from 'vitest';
import { render, screen, userEvent } from './ui';

function Counter() {
  return (
    <div>
      <span>こんにちは</span>
      <button type="button" onClick={() => alert('clicked')}>
        ボタン
      </button>
    </div>
  );
}

describe('UIテスト基盤 (jsdom)', () => {
  it('コンポーネントを描画してテキストを取得できる', () => {
    render(<Counter />);
    expect(screen.getByText('こんにちは')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ボタン' })).toBeTruthy();
  });

  it('userEvent でクリックを再現できる', async () => {
    const user = userEvent.setup();
    let clicked = false;
    function Btn() {
      return (
        <button type="button" onClick={() => { clicked = true; }}>
          押す
        </button>
      );
    }
    render(<Btn />);
    await user.click(screen.getByRole('button', { name: '押す' }));
    expect(clicked).toBe(true);
  });
});
