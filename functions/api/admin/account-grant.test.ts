// POST /api/admin/account-grant: tester on/off + VIP 付与/解除 (D1 スタブ)。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb } from '../../test/fakeDb';
import type { AccountRow } from '../../lib/types';

vi.mock('../../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../../lib/auth')>()),
  resolveAccountFromRequest: vi.fn(),
}));

import { resolveAccountFromRequest } from '../../lib/auth';
import { onRequestPost } from './account-grant';

function acct(over: Partial<AccountRow>): AccountRow {
  return {
    id: 9, poker_name: 'u', private_pass: 'pw', is_admin: 0, created_at: 0,
    last_login_at: null, points: 0, is_ranking_excluded: 0, tester: 0, vip_until: null, ...over,
  };
}

const ADMIN = acct({ id: 1, poker_name: 'admin', is_admin: 1 });

function ctx(body: unknown, db: D1Database) {
  const request = new Request('https://x/api/admin/account-grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { request, env: { DB: db } } as unknown as Parameters<typeof onRequestPost>[0];
}

// findAccountById (.first FROM accounts) は target を返す。
function dbWithTarget(target: AccountRow) {
  return makeFakeDb((sql) => (sql.includes('FROM accounts') ? target : null));
}

beforeEach(() => {
  vi.mocked(resolveAccountFromRequest).mockResolvedValue(ADMIN);
});

describe('account-grant', () => {
  it('非 admin は 403', async () => {
    vi.mocked(resolveAccountFromRequest).mockResolvedValue(acct({ is_admin: 0 }));
    const { db } = dbWithTarget(acct({ id: 9 }));
    const res = await onRequestPost(ctx({ id: 9, type: 'tester', value: true }, db));
    expect(res.status).toBe(403);
  });

  it('tester on: UPDATE tester=1', async () => {
    const { db, exec } = dbWithTarget(acct({ id: 9 }));
    const res = await onRequestPost(ctx({ id: 9, type: 'tester', value: true }, db));
    expect(res.status).toBe(200);
    const upd = exec.find((e) => e.sql.includes('UPDATE accounts SET tester'));
    expect(upd!.args).toContain(1);
  });

  it('tester off: UPDATE tester=0', async () => {
    const { db, exec } = dbWithTarget(acct({ id: 9, tester: 1 }));
    await onRequestPost(ctx({ id: 9, type: 'tester', value: false }, db));
    const upd = exec.find((e) => e.sql.includes('UPDATE accounts SET tester'));
    expect(upd!.args).toContain(0);
  });

  it('VIP 付与 (days=60): vip_until = now + 60日', async () => {
    const before = Date.now();
    const { db, exec } = dbWithTarget(acct({ id: 9 }));
    await onRequestPost(ctx({ id: 9, type: 'vip', days: 60 }, db));
    const upd = exec.find((e) => e.sql.includes('UPDATE accounts SET vip_until = ?'));
    const until = upd!.args[0] as number;
    expect(until).toBeGreaterThanOrEqual(before + 60 * 86400000);
    expect(until).toBeLessThanOrEqual(Date.now() + 60 * 86400000 + 5000);
  });

  it('VIP 解除 (days=null): vip_until = NULL', async () => {
    const { db, exec } = dbWithTarget(acct({ id: 9, vip_until: 999 }));
    await onRequestPost(ctx({ id: 9, type: 'vip', days: null }, db));
    expect(exec.some((e) => e.sql.includes('UPDATE accounts SET vip_until = NULL'))).toBe(true);
  });

  it('VIP days 範囲外 (366) は 400', async () => {
    const { db } = dbWithTarget(acct({ id: 9 }));
    const res = await onRequestPost(ctx({ id: 9, type: 'vip', days: 366 }, db));
    expect(res.status).toBe(400);
  });

  it('存在しない id は 404', async () => {
    const { db } = makeFakeDb(() => null); // findAccountById → null
    const res = await onRequestPost(ctx({ id: 999, type: 'tester', value: true }, db));
    expect(res.status).toBe(404);
  });

  it('不正 type は 400', async () => {
    const { db } = dbWithTarget(acct({ id: 9 }));
    const res = await onRequestPost(ctx({ id: 9, type: 'bogus' }, db));
    expect(res.status).toBe(400);
  });
});
