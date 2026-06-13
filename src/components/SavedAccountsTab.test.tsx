// @vitest-environment jsdom
// 保存済みタブ: group_key 空でも login を呼ぶ (tester/VIP/admin はサーバ側で免除)。

import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '../test/ui';
import { AuthContext, type AuthState } from '../contexts/AuthContext';
import { SavedAccountsTab } from './SavedAccountsTab';
import type { SavedAccount } from '../data/savedAccounts';

function makeAuth(login: AuthState['login']): AuthState {
  return {
    status: 'unauthenticated',
    account: null,
    sessionId: null,
    signedOutReason: null,
    login,
    signup: async () => {},
    logout: async () => {},
  };
}

const TESTER: SavedAccount = { poker_name: 'ryoji', private_pass: 'rj', last_used_at: 1, tester: true };

function renderTab(login: AuthState['login'], account: SavedAccount = TESTER) {
  render(
    <AuthContext.Provider value={makeAuth(login)}>
      <SavedAccountsTab accounts={[account]} onListChange={() => {}} onSwitchToLoginTab={() => {}} />
    </AuthContext.Provider>,
  );
}

describe('SavedAccountsTab group_key 任意化', () => {
  it('group_key 空でも login が groupKey="" で呼ばれる', async () => {
    const user = userEvent.setup();
    const login = vi.fn(async () => {});
    renderTab(login);
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ pokerName: 'ryoji', privatePass: 'rj', groupKey: '' }),
    );
    // 旧挙動の「Group Key を入力してください」エラーは出ない。
    expect(screen.queryByText('Group Key を入力してください')).toBeNull();
  });

  it('group_key 入力時は trim した値を渡す', async () => {
    const user = userEvent.setup();
    const login = vi.fn(async () => {});
    renderTab(login);
    await user.type(screen.getByPlaceholderText('Group Key (任意)'), '  6283  ');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ pokerName: 'ryoji', privatePass: 'rj', groupKey: '6283' }),
    );
  });
});
