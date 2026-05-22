// POST /api/session/ping のテスト (D1 はスタブ、実 DB 非接触)。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, postRequest } from '../../test/fakeDb';
import type { AccountRow } from '../../lib/types';

vi.mock('../../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../../lib/auth')>()),
  resolveAccountFromRequest: vi.fn(),
}));

import { resolveAccountFromRequest } from '../../lib/auth';
import { onRequestPost } from './ping';

const ACCOUNT = { id: 7, poker_name: 'tester', is_admin: 0, is_ranking_excluded: 0 } as unknown as AccountRow;

function ctx(request: Request, db: D1Database) {
  return { request, env: { DB: db } } as unknown as Parameters<typeof onRequestPost>[0];
}

beforeEach(() => {
  vi.mocked(resolveAccountFromRequest).mockReset();
});

describe('session/ping POST', () => {
  it('有効セッション → 200 { ok: true } (resolveAccountFromRequest 経由で last_accessed 更新)', async () => {
    vi.mocked(resolveAccountFromRequest).mockResolvedValue(ACCOUNT);
    const { db } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({}), db));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(resolveAccountFromRequest).toHaveBeenCalledTimes(1);
  });

  it('失効/未認証 → 401', async () => {
    vi.mocked(resolveAccountFromRequest).mockResolvedValue(null);
    const { db } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({}), db));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });
});
