// POST /api/account/missed-problems の書き込み経路テスト (D1 スタブ)。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, postRequest } from '../../test/fakeDb';
import type { AccountRow } from '../../lib/types';

vi.mock('../../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../../lib/auth')>()),
  resolveAccountFromRequest: vi.fn(),
}));

import { resolveAccountFromRequest } from '../../lib/auth';
import { onRequestPost, onRequestGet } from './missed-problems';

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

  it('初級拡張モード (open / vs_open / vs_3bet / vs_4bet) は受理される', async () => {
    const recs = [
      { training_type: 'preflop_beginner_open', scenario_type: 'beginner_open', hero_position: 'HJ', hand: 'A5s', user_selections: ['__slider__', '50'], gto_strategy: { allin: 0, raise: 50, call: 0, fold: 50 }, score_obtained: -1 },
      { training_type: 'preflop_beginner_vs_open', scenario_type: 'beginner_vs_open', hero_position: 'BB', opener_position: 'CO', hand: 'K9o', user_selections: ['call'], gto_strategy: { allin: 0, raise: 0, call: 100, fold: 0 }, score_obtained: -1 },
      { training_type: 'preflop_beginner_vs_3bet_4bet', scenario_type: 'beginner_vs_3bet', hero_position: 'UTG', opener_position: 'UTG', three_bettor_position: 'BB', hand: 'AKs', user_selections: ['raise'], gto_strategy: { allin: 0, raise: 100, call: 0, fold: 0 }, score_obtained: -1 },
      { training_type: 'preflop_beginner_vs_3bet_4bet', scenario_type: 'beginner_vs_4bet', hero_position: 'BB', opener_position: 'UTG', three_bettor_position: 'BB', hand: 'AA', user_selections: ['allin'], gto_strategy: { allin: 100, raise: 0, call: 0, fold: 0 }, score_obtained: -1 },
    ];
    const { db } = makeFakeDb();
    const res = await onRequestPost(ctx(postRequest({ records: recs }), db));
    expect(await res.json()).toMatchObject({ inserted: 4 });
  });
});

describe('missed-problems GET (階級プール)', () => {
  function getCtx(level: string, db: D1Database) {
    const request = new Request(`https://x/api/account/missed-problems?level=${level}&limit=50`);
    return { request, env: { DB: db } } as unknown as Parameters<typeof onRequestGet>[0];
  }

  it('tier_pf_beginner は 4 training_type を IN で一括取得', async () => {
    const { db, exec } = makeFakeDb();
    await onRequestGet(getCtx('tier_pf_beginner', db));
    const sel = exec.find((e) => e.sql.includes('SELECT * FROM missed_problems'));
    expect(sel).toBeDefined();
    expect(sel!.sql).toContain('IN (?, ?, ?, ?)');
    expect(sel!.args).toContain('preflop_beginner');
    expect(sel!.args).toContain('preflop_beginner_open');
    expect(sel!.args).toContain('preflop_beginner_vs_open');
    expect(sel!.args).toContain('preflop_beginner_vs_3bet_4bet');
  });

  it('tier_flop_intermediate は CB系3種を IN で取得', async () => {
    const { db, exec } = makeFakeDb();
    await onRequestGet(getCtx('tier_flop_intermediate', db));
    const sel = exec.find((e) => e.sql.includes('SELECT * FROM missed_problems'));
    expect(sel!.sql).toContain('IN (?, ?, ?)');
    expect(sel!.args).toContain('flop_cb_srp');
    expect(sel!.args).toContain('flop_donk_bmcb');
  });

  it('従来の単一 level (beginner) は単一 training_type で取得', async () => {
    const { db, exec } = makeFakeDb();
    await onRequestGet(getCtx('beginner', db));
    const sel = exec.find((e) => e.sql.includes('SELECT * FROM missed_problems'));
    expect(sel!.sql).toContain('IN (?)');
    expect(sel!.args).toContain('preflop_beginner');
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
