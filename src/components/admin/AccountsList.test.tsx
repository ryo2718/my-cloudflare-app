// @vitest-environment jsdom
// AccountsList: テスター/VIP 列の表示・トグル・付与操作。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '../../test/ui';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ sessionId: 'sid', account: { poker_name: 'admin', is_admin: true }, status: 'authenticated', login: vi.fn(), signup: vi.fn(), logout: vi.fn(), signedOutReason: null }),
}));
vi.mock('../../api/admin', async (orig) => ({
  ...(await orig<typeof import('../../api/admin')>()),
  apiAdminListAccounts: vi.fn(async () => [
    { id: 9, poker_name: 'taro', private_pass: 'pw', is_admin: false, created_at: 0, last_login_at: null, total_points: 0, tester: false, vip_until: Date.now() + 5 * 86400000 },
  ]),
  apiAdminAccountGrant: vi.fn(async () => ({ account: { id: 9, poker_name: 'taro', tester: true, vip_until: null } })),
}));

import { AccountsList } from './AccountsList';
import { apiAdminAccountGrant } from '../../api/admin';

beforeEach(() => {
  vi.mocked(apiAdminAccountGrant).mockClear();
});

describe('AccountsList テスター/VIP', () => {
  it('テスター/VIP 列・VIP残り日数・テスタートグルを表示する', async () => {
    render(<AccountsList />);
    expect(await screen.findByText('テスター')).toBeTruthy();
    expect(screen.getByText('VIP')).toBeTruthy();
    // tester=false → OFF ボタン。
    expect(screen.getByRole('button', { name: 'OFF' })).toBeTruthy();
    // vip_until 未来 → 「残りN日」。
    expect(screen.getByText(/残り\d+日/)).toBeTruthy();
  });

  it('テスタートグル押下で account-grant(tester,value=true) を呼ぶ', async () => {
    const user = userEvent.setup();
    render(<AccountsList />);
    await user.click(await screen.findByRole('button', { name: 'OFF' }));
    await waitFor(() =>
      expect(vi.mocked(apiAdminAccountGrant)).toHaveBeenCalledWith('sid', { id: 9, type: 'tester', value: true }),
    );
    // 反映後は ON 表示。
    expect(await screen.findByRole('button', { name: 'ON' })).toBeTruthy();
  });

  it('VIP「適用」押下で account-grant(vip,days) を呼ぶ', async () => {
    const user = userEvent.setup();
    render(<AccountsList />);
    await user.click(await screen.findByRole('button', { name: '適用' }));
    await waitFor(() =>
      expect(vi.mocked(apiAdminAccountGrant)).toHaveBeenCalledWith('sid', { id: 9, type: 'vip', days: 30 }),
    );
  });
});
