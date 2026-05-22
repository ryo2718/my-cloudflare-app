// POST /api/account/problem-attempts の書き込み経路テスト (D1 スタブ)。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, postRequest } from '../../test/fakeDb';
import type { AccountRow } from '../../lib/types';

vi.mock('../../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../../lib/auth')>()),
  resolveAccountFromRequest: vi.fn(),
}));

import { resolveAccountFromRequest } from '../../lib/auth';
import { onRequestPost } from './problem-attempts';

const ACCOUNT = { id: 7 } as unknown as AccountRow;

function ctx(request: Request, db: D1Database) {
  return { request, env: { DB: db } } as unknown as Parameters<typeof onRequestPost>[0];
}

const VALID = {
  training_type: 'preflop_beginner',
  scenario_type: 'beginner_open',
  hero_position: 'UTG',
  hand: 'AA',
  score_obtained: 1,
};

beforeEach(() => {
  vi.mocked(resolveAccountFromRequest).mockResolvedValue(ACCOUNT);
});

describe('problem-attempts POST', () => {
  it('有効レコードは problem_attempts に batch INSERT', async () => {
    const { db, exec } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({ records: [VALID, VALID] }), db));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ inserted: 2 });
    const inserts = exec.filter((e) => e.sql.includes('INSERT INTO problem_attempts'));
    expect(inserts.length).toBe(2);
    expect(inserts[0].args).toContain(7); // account_id
    expect(inserts[0].args).toContain('beginner_open');
  });

  it('不正レコードは除外され inserted=0 (書き込みなし)', async () => {
    const { db, exec } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({ records: [{ training_type: 'bogus' }] }), db));
    expect(await res.json()).toMatchObject({ inserted: 0 });
    expect(exec.some((e) => e.sql.includes('INSERT INTO problem_attempts'))).toBe(false);
  });

  it('records が配列でない場合は 400', async () => {
    const { db } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({ records: 'x' }), db));
    expect(res.status).toBe(400);
  });

  it('未認証は 401', async () => {
    vi.mocked(resolveAccountFromRequest).mockResolvedValue(null);
    const { db, exec } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({ records: [VALID] }), db));
    expect(res.status).toBe(401);
    expect(exec.length).toBe(0);
  });
});
