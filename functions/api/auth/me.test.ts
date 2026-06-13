// GET /api/auth/me: レスポンス account に is_admin / tester / vip_until が含まれる。

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../../lib/auth')>()),
  resolveAccountFromRequest: vi.fn(),
}));

import { resolveAccountFromRequest } from '../../lib/auth';
import { onRequestGet } from './me';
import type { AccountRow } from '../../lib/types';

function acct(over: Partial<AccountRow>): AccountRow {
  return {
    id: 5, poker_name: 'u', private_pass: 'pw', is_admin: 0, created_at: 0,
    last_login_at: null, points: 0, is_ranking_excluded: 0, tester: 0, vip_until: null, ...over,
  };
}

function ctx() {
  const request = new Request('https://x/api/auth/me', { headers: { Authorization: 'Bearer sid' } });
  return { request, env: { DB: {} } } as unknown as Parameters<typeof onRequestGet>[0];
}

describe('me', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(resolveAccountFromRequest).mockResolvedValue(null);
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(401);
  });

  it('account に is_admin / tester / vip_until が含まれる', async () => {
    const until = Date.now() + 1_000_000;
    vi.mocked(resolveAccountFromRequest).mockResolvedValue(acct({ is_admin: 1, tester: 1, vip_until: until }));
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { account: { is_admin: boolean; tester: boolean; vip_until: number | null } };
    expect(body.account.is_admin).toBe(true);
    expect(body.account.tester).toBe(true);
    expect(body.account.vip_until).toBe(until);
  });
});
