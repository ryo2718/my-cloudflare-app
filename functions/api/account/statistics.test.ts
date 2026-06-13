// GET /api/account/statistics の集計 SQL を検証 (D1 スタブで実行 SQL を記録)。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb } from '../../test/fakeDb';
import type { AccountRow } from '../../lib/types';

vi.mock('../../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../../lib/auth')>()),
  resolveAccountFromRequest: vi.fn(),
}));

import { resolveAccountFromRequest } from '../../lib/auth';
import { onRequestGet } from './statistics';

const ACCOUNT = { id: 7 } as unknown as AccountRow;

function getCtx(db: D1Database) {
  const request = new Request('https://x/api/account/statistics');
  return { request, env: { DB: db } } as unknown as Parameters<typeof onRequestGet>[0];
}

beforeEach(() => {
  vi.mocked(resolveAccountFromRequest).mockResolvedValue(ACCOUNT);
});

describe('statistics GET 集計 SQL', () => {
  it('ポジション別・シナリオ別はプリフロップ限定 (training_type LIKE preflop_%)', async () => {
    const { db, exec } = makeFakeDb();
    await onRequestGet(getCtx(db));
    const pos = exec.find((e) => e.sql.includes('GROUP BY hero_position'));
    const scen = exec.find((e) => e.sql.includes('GROUP BY scenario_type'));
    expect(pos!.sql).toContain("training_type LIKE 'preflop_%'");
    expect(scen!.sql).toContain("training_type LIKE 'preflop_%'");
  });

  it('モード別 (by_level) は全モード対象 (LIKE フィルタなし)', async () => {
    const { db, exec } = makeFakeDb();
    await onRequestGet(getCtx(db));
    const level = exec.find((e) => e.sql.includes('GROUP BY training_type'));
    expect(level!.sql).not.toContain("LIKE 'preflop_%'");
  });

  it('満点式は 中級総合 + フロップ中級(CB/ドンク) を 2pt 扱い', async () => {
    const { db, exec } = makeFakeDb();
    await onRequestGet(getCtx(db));
    const level = exec.find((e) => e.sql.includes('GROUP BY training_type'));
    expect(level!.sql).toContain('flop_cb_srp');
    expect(level!.sql).toContain('flop_cb_3bp');
    expect(level!.sql).toContain('flop_donk_bmcb');
    expect(level!.sql).toContain("'preflop_intermediate'");
  });
});
