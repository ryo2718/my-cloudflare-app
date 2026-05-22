// POST /api/account/training-result の書き込み経路テスト (D1 はスタブ、実 DB 非接触)。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, postRequest } from '../../test/fakeDb';
import type { AccountRow, TrainingResultRow } from '../../lib/types';

vi.mock('../../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../../lib/auth')>()),
  resolveAccountFromRequest: vi.fn(),
}));
vi.mock('../../lib/achievements', () => ({ evaluateAchievements: vi.fn(async () => {}) }));

import { resolveAccountFromRequest } from '../../lib/auth';
import { currentSeason } from '../../lib/season';
import { onRequestPost } from './training-result';

const ACCOUNT = { id: 7, poker_name: 'tester', is_admin: 0, is_ranking_excluded: 0 } as unknown as AccountRow;

function ctx(request: Request, db: D1Database) {
  return { request, env: { DB: db } } as unknown as Parameters<typeof onRequestPost>[0];
}

beforeEach(() => {
  vi.mocked(resolveAccountFromRequest).mockResolvedValue(ACCOUNT);
});

describe('training-result POST', () => {
  it('新規: training_results に INSERT (score / total=1 / 現行シーズン)', async () => {
    const { db, exec } = makeFakeDb((sql) => (sql.includes('SELECT') ? null : null)); // existing なし
    const res = await onRequestPost(ctx(postRequest({ training_type: 'preflop_intermediate', score: 30 }), db));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ is_best: true, previous_best: 0, current_best: 30, total_attempts: 1 });

    const insert = exec.find((e) => e.sql.includes('INSERT INTO training_results'));
    expect(insert).toBeDefined();
    expect(insert!.args).toContain(7); // account_id
    expect(insert!.args).toContain('preflop_intermediate');
    expect(insert!.args).toContain(30); // best_score / season_score
    expect(insert!.args).toContain(currentSeason().id); // 現行シーズン計上
  });

  it('既存・ベスト更新: UPDATE、is_best=true、season_score=max', async () => {
    const existing = {
      id: 99, account_id: 7, training_type: 'preflop_intermediate',
      best_score: 10, best_score_at: 1, total_attempts: 3,
      season_score: 10, season_id: currentSeason().id,
    } as unknown as TrainingResultRow;
    const { db, exec } = makeFakeDb((sql) => (sql.includes('SELECT') ? existing : null));
    const res = await onRequestPost(ctx(postRequest({ training_type: 'preflop_intermediate', score: 15 }), db));
    expect(await res.json()).toMatchObject({ is_best: true, previous_best: 10, current_best: 15, total_attempts: 4 });

    const update = exec.find((e) => e.sql.includes('UPDATE training_results'));
    expect(update).toBeDefined();
    expect(update!.args).toContain(15); // new best & season_score(max(10,15))
    expect(update!.args).toContain(4); // total_attempts
  });

  it('既存・低スコア: ベスト更新せず total_attempts のみ増える', async () => {
    const existing = {
      id: 99, account_id: 7, training_type: 'preflop_intermediate',
      best_score: 20, best_score_at: 1, total_attempts: 5,
      season_score: 20, season_id: currentSeason().id,
    } as unknown as TrainingResultRow;
    const { db } = makeFakeDb((sql) => (sql.includes('SELECT') ? existing : null));
    const res = await onRequestPost(ctx(postRequest({ training_type: 'preflop_intermediate', score: 5 }), db));
    expect(await res.json()).toMatchObject({ is_best: false, current_best: 20, total_attempts: 6 });
  });

  it('シーズン跨ぎ: season_id が変わると season_score を今回値にリセット', async () => {
    const existing = {
      id: 99, account_id: 7, training_type: 'preflop_intermediate',
      best_score: 20, best_score_at: 1, total_attempts: 5,
      season_score: 18, season_id: 'OLD-SEASON',
    } as unknown as TrainingResultRow;
    const { db, exec } = makeFakeDb((sql) => (sql.includes('SELECT') ? existing : null));
    await onRequestPost(ctx(postRequest({ training_type: 'preflop_intermediate', score: 7 }), db));
    const update = exec.find((e) => e.sql.includes('UPDATE training_results'))!;
    // 別シーズン → season_score = 今回 score (7)、season_id = 現行
    expect(update.args).toContain(7);
    expect(update.args).toContain(currentSeason().id);
  });

  it('不正な training_type は 400、書き込みなし', async () => {
    const { db, exec } = makeFakeDb(() => null);
    const res = await onRequestPost(ctx(postRequest({ training_type: 'bogus', score: 10 }), db));
    expect(res.status).toBe(400);
    expect(exec.some((e) => /INSERT|UPDATE/.test(e.sql))).toBe(false);
  });

  it('未認証は 401、書き込みなし', async () => {
    vi.mocked(resolveAccountFromRequest).mockResolvedValue(null);
    const { db, exec } = makeFakeDb(() => null);
    const res = await onRequestPost(ctx(postRequest({ training_type: 'preflop_intermediate', score: 10 }), db));
    expect(res.status).toBe(401);
    expect(exec.length).toBe(0);
  });
});
