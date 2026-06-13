// POST /api/auth/login: tester/VIP/admin の group_key 免除分岐 (D1 スタブ)。

import { describe, it, expect } from 'vitest';
import { makeFakeDb } from '../../test/fakeDb';
import { onRequestPost } from './login';
import type { AccountRow } from '../../lib/types';

const ACTIVE_KEY = { id: 1, key_value: '6283', active_from: 0, active_until: null, created_at: 0 };

function acct(over: Partial<AccountRow>): AccountRow {
  return {
    id: 9,
    poker_name: 'u',
    private_pass: 'pw',
    is_admin: 0,
    created_at: 0,
    last_login_at: null,
    points: 0,
    is_ranking_excluded: 0,
    tester: 0,
    vip_until: null,
    ...over,
  };
}

function dbFor(account: AccountRow) {
  return makeFakeDb((sql) => {
    if (sql.includes('FROM accounts')) return account;
    if (sql.includes('FROM group_keys')) return ACTIVE_KEY;
    return null; // sessions (hasActiveSession 等) は無し
  }).db;
}

function loginCtx(account: AccountRow, body: Record<string, unknown>) {
  const request = new Request('https://x/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { request, env: { DB: dbFor(account) } } as unknown as Parameters<typeof onRequestPost>[0];
}

const base = { poker_name: 'u', private_pass: 'pw' };

describe('login group_key 免除', () => {
  it('tester=1 は group_key 空でも 200', async () => {
    const res = await onRequestPost(loginCtx(acct({ tester: 1 }), { ...base, group_key: '' }));
    expect(res.status).toBe(200);
  });

  it('VIP (vip_until 未来) は group_key 空でも 200', async () => {
    const res = await onRequestPost(loginCtx(acct({ vip_until: Date.now() + 1_000_000 }), { ...base, group_key: '' }));
    expect(res.status).toBe(200);
  });

  it('VIP 期限切れ (vip_until 過去) は group_key 必要 → 空は 401', async () => {
    const res = await onRequestPost(loginCtx(acct({ vip_until: Date.now() - 1_000_000 }), { ...base, group_key: '' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'invalid_group_key' });
  });

  it('admin は group_key 空でも 200', async () => {
    const res = await onRequestPost(loginCtx(acct({ is_admin: 1 }), { ...base, group_key: '' }));
    expect(res.status).toBe(200);
  });

  it('非免除アカウントは group_key 必要 (空 → 401)', async () => {
    const res = await onRequestPost(loginCtx(acct({}), { ...base, group_key: '' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'invalid_group_key' });
  });

  it('非免除アカウントは正しい group_key で 200', async () => {
    const res = await onRequestPost(loginCtx(acct({}), { ...base, group_key: '6283' }));
    expect(res.status).toBe(200);
  });

  it('private_pass 不一致は group_key より先に invalid_credentials', async () => {
    const res = await onRequestPost(loginCtx(acct({}), { ...base, private_pass: 'wrong', group_key: '6283' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'invalid_credentials' });
  });

  it('poker_name 欠落は 400 (group_key は任意)', async () => {
    const res = await onRequestPost(loginCtx(acct({}), { private_pass: 'pw' }));
    expect(res.status).toBe(400);
  });
});
