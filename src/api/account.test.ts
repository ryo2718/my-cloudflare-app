import { describe, it, expect, afterEach, vi } from 'vitest';
import { apiAccountMe, apiResetResults } from './account';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiAccountMe', () => {
  it('GET /api/account/me with Bearer header → AccountDetail', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        poker_name: 'テスト君',
        points: 42,
        training_results: [],
      }),
    });
    vi.stubGlobal('fetch', spy);
    const detail = await apiAccountMe('sid-1');
    expect(spy).toHaveBeenCalledWith('/api/account/me', {
      headers: { Authorization: 'Bearer sid-1' },
    });
    expect(detail.poker_name).toBe('テスト君');
    expect(detail.points).toBe(42);
    expect(detail.training_results).toEqual([]);
  });

  it('401 → AuthApiError(code=unauthorized)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized' }),
      }),
    );
    await expect(apiAccountMe('bad')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });

  it('training_results が含まれていれば配列で受け取れる (新スキーマ v2)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          poker_name: 'a',
          points: 0,
          training_results: [
            {
              id: 1,
              account_id: 1,
              training_type: 'preflop_beginner',
              best_score: 18,
              best_score_at: 1700000000000,
              total_attempts: 5,
              updated_at: 1700000000000,
            },
          ],
        }),
      }),
    );
    const detail = await apiAccountMe('sid');
    expect(detail.training_results).toHaveLength(1);
    expect(detail.training_results[0].training_type).toBe('preflop_beginner');
    expect(detail.training_results[0].best_score).toBe(18);
    expect(detail.training_results[0].total_attempts).toBe(5);
  });
});

describe('apiResetResults', () => {
  it('DELETE /api/account/reset-results with Bearer → {deleted}', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ deleted: 4 }),
    });
    vi.stubGlobal('fetch', spy);
    const res = await apiResetResults('sid-1');
    expect(spy).toHaveBeenCalledWith('/api/account/reset-results', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer sid-1' },
    });
    expect(res.deleted).toBe(4);
  });

  it('403 → AuthApiError(code=forbidden) (一般ユーザー)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'forbidden' }),
      }),
    );
    await expect(apiResetResults('sid-x')).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
    });
  });

  it('401 → AuthApiError(code=unauthorized)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized' }),
      }),
    );
    await expect(apiResetResults('bad')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });
});
