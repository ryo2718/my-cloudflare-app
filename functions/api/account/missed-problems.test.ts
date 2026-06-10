// POST /api/account/missed-problems の書き込み経路テスト (D1 スタブ)。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, postRequest } from '../../test/fakeDb';
import type { AccountRow } from '../../lib/types';

vi.mock('../../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../../lib/auth')>()),
  resolveAccountFromRequest: vi.fn(),
}));

import { resolveAccountFromRequest } from '../../lib/auth';
import { onRequestPost } from './missed-problems';

const ACCOUNT = { id: 7 } as unknown as AccountRow;

function ctx(request: Request, db: D1Database) {
  return { request, env: { DB: db } } as unknown as Parameters<typeof onRequestPost>[0];
}

const VALID = {
  training_type: 'preflop_intermediate',
  scenario_type: 'vs_3bet',
  hero_position: 'BB',
  hand: 'AA',
  user_selections: ['call'],
  gto_strategy: { allin: 0, raise: 0, call: 100, fold: 0 },
  score_obtained: 1,
};

beforeEach(() => {
  vi.mocked(resolveAccountFromRequest).mockResolvedValue(ACCOUNT);
});

describe('missed-problems POST', () => {
  it('有効レコードは missed_problems に batch INSERT (selections/strategy は JSON 文字列)', async () => {
    const { db, exec } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({ records: [VALID] }), db));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ inserted: 1 });

    const insert = exec.find((e) => e.sql.includes('INSERT INTO missed_problems'));
    expect(insert).toBeDefined();
    expect(insert!.args).toContain(7); // account_id
    expect(insert!.args).toContain('vs_3bet');
    expect(insert!.args).toContain(JSON.stringify(['call']));
    expect(insert!.args).toContain(JSON.stringify({ allin: 0, raise: 0, call: 100, fold: 0 }));
  });

  it('不正レコードは除外され inserted=0', async () => {
    const { db, exec } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({ records: [{ training_type: 'bogus' }] }), db));
    expect(await res.json()).toMatchObject({ inserted: 0 });
    expect(exec.some((e) => e.sql.includes('INSERT INTO missed_problems'))).toBe(false);
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

describe('missed-problems POST (flop)', () => {
  const FLOP_VALID = {
    training_type: 'flop_cb_srp',
    scenario_type: 'flop_cb',
    hero_position: 'BTN',
    opener_position: 'BB',
    hand: '-',
    user_selections: [],
    gto_strategy: { allin: 0, raise: 0, call: 0, fold: 0 },
    score_obtained: 0,
    metadata: JSON.stringify({ board: 'AdAc3d', variant: 'cor_btnc', pot: 'SRP', kind: 'cb' }),
  };

  it('flop_* training_type + metadata は受理され metadata を INSERT する', async () => {
    const { db, exec } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({ records: [FLOP_VALID] }), db));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ inserted: 1 });
    const insert = exec.find((e) => e.sql.includes('INSERT INTO missed_problems'));
    expect(insert).toBeDefined();
    expect(insert!.sql).toContain('metadata');
    expect(insert!.args).toContain('flop_cb_srp');
    expect(insert!.args).toContain(FLOP_VALID.metadata);
  });

  it('flop で metadata 欠落は除外され inserted=0', async () => {
    const { db, exec } = makeFakeDb();
    const noMeta = { ...FLOP_VALID, metadata: undefined };
    const res = await onRequestPost(ctx(postRequest({ records: [noMeta] }), db));
    expect(await res.json()).toMatchObject({ inserted: 0 });
    expect(exec.some((e) => e.sql.includes('INSERT INTO missed_problems'))).toBe(false);
  });
});
