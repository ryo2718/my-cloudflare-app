import { describe, it, expect, afterEach, vi } from 'vitest';
import { apiAccountMe } from './account';

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

  it('training_results が含まれていれば配列で受け取れる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          poker_name: 'a',
          points: 0,
          training_results: [
            { id: 1, account_id: 1, training_type: 'preflop', score: 8, completed_at: 1 },
          ],
        }),
      }),
    );
    const detail = await apiAccountMe('sid');
    expect(detail.training_results).toHaveLength(1);
    expect(detail.training_results[0].training_type).toBe('preflop');
  });
});
