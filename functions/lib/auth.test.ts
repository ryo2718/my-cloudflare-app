// resolveAccountFromSession: admin はアイドル失効を免除する (D1 スタブ)。

import { describe, it, expect } from 'vitest';
import { makeFakeDb } from '../test/fakeDb';
import { resolveAccountFromSession } from './auth';
import type { AccountRow } from './types';

function acct(over: Partial<AccountRow>): AccountRow {
  return {
    id: 5, poker_name: 'u', private_pass: 'pw', is_admin: 0, created_at: 0,
    last_login_at: null, points: 0, is_ranking_excluded: 0, tester: 0, vip_until: null, ...over,
  };
}

const SESSION = { id: 'sid', account_id: 5, created_at: 0, expires_at: Date.now() + 1_000_000, last_accessed_at: 0 };

// findActiveSession (last_accessed_at 条件あり) は null = アイドル失効。
// findSessionIgnoringIdle (expires_at のみ) は SESSION を返す。
function dbFor(account: AccountRow) {
  return makeFakeDb((sql) => {
    if (sql.includes('FROM sessions') && sql.includes('last_accessed_at')) return null;
    if (sql.includes('FROM sessions')) return SESSION;
    if (sql.includes('FROM accounts')) return account;
    return null;
  }).db;
}

describe('resolveAccountFromSession admin idle 免除', () => {
  it('admin はアイドル失効していても account を返す', async () => {
    const acc = await resolveAccountFromSession(dbFor(acct({ is_admin: 1 })), 'sid');
    expect(acc).not.toBeNull();
    expect(acc!.is_admin).toBe(1);
  });

  it('非 admin はアイドル失効で null', async () => {
    const acc = await resolveAccountFromSession(dbFor(acct({ is_admin: 0 })), 'sid');
    expect(acc).toBeNull();
  });
});
