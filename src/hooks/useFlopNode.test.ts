import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchFlopNode } from './useFlopNode';

const BASE = 'https://example.r2.dev/data/flop/v1/cash_100bb';

beforeEach(() => {
  vi.stubEnv('VITE_FLOP_DATA_BASE_URL', BASE);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('fetchFlopNode — URL construction', () => {
  it('builds URL with flop_root.json for empty chain', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _meta: { variant: 'utgr_bbc' } }),
    });
    vi.stubGlobal('fetch', mockFetch);
    await fetchFlopNode('utgr_bbc', []);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/utgr_bbc/flop_root.json`,
      undefined,
    );
  });

  it('builds URL with chain-encoded filename', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _meta: { variant: 'utgr_bbc' } }),
    });
    vi.stubGlobal('fetch', mockFetch);
    await fetchFlopNode('utgr_bbc', ['bb_b1_8', 'utg_r6_35']);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/utgr_bbc/flop_bb_b1_8_utg_r6_35.json`,
      undefined,
    );
  });

  it('handles all-in tokens in chain (bAI/rAI preserved)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);
    await fetchFlopNode('utgr_bbc', ['bb_b1_8', 'utg_rAI']);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/utgr_bbc/flop_bb_b1_8_utg_rAI.json`,
      undefined,
    );
  });
});

describe('fetchFlopNode — error handling', () => {
  it('throws when VITE_FLOP_DATA_BASE_URL is empty', async () => {
    vi.stubEnv('VITE_FLOP_DATA_BASE_URL', '');
    await expect(fetchFlopNode('utgr_bbc', [])).rejects.toThrow(/not set/i);
  });

  it('throws on non-2xx response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    vi.stubGlobal('fetch', mockFetch);
    await expect(fetchFlopNode('utgr_bbc', [])).rejects.toThrow(/404|Not Found/);
  });

  it('rethrows network errors', async () => {
    const networkErr = new Error('ENOTFOUND example.r2.dev');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkErr));
    await expect(fetchFlopNode('utgr_bbc', [])).rejects.toThrow(/ENOTFOUND/);
  });
});

describe('fetchFlopNode — AbortSignal', () => {
  it('forwards signal to fetch when provided', async () => {
    const ctrl = new AbortController();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);
    await fetchFlopNode('utgr_bbc', [], ctrl.signal);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      { signal: ctrl.signal },
    );
  });

  it('omits options arg when signal is undefined', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);
    await fetchFlopNode('utgr_bbc', []);
    expect(mockFetch).toHaveBeenCalledWith(expect.any(String), undefined);
  });
});

describe('fetchFlopNode — JSON response', () => {
  it('returns the parsed JSON body as FlopNode', async () => {
    const fakeNode = {
      _meta: { variant: 'utgr_bbc', depth: 0, next_actor: 'bb' },
      action_totals: [{ action_code: 'X', frequency: 0.9, solved_action_count: 1755 }],
      solutions: [{ name: '2h2d2c', action_solutions: [], player_solutions: [] }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => fakeNode }),
    );
    const result = await fetchFlopNode('utgr_bbc', []);
    expect(result).toEqual(fakeNode);
  });
});
