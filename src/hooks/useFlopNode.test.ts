import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchFlopNode, clearFlopNodeCache } from './useFlopNode';

const BASE = 'https://example.r2.dev/data/flop/v1/cash_100bb';

beforeEach(() => {
  vi.stubEnv('VITE_FLOP_DATA_BASE_URL', BASE);
  // Phase 4 以降: module-level cache を test 間で必ずクリア。
  clearFlopNodeCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearFlopNodeCache();
});

describe('fetchFlopNode — URL construction', () => {
  it('builds URL with flop_root.json for empty chain', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _meta: { variant: 'utgr_bbc' } }),
    });
    vi.stubGlobal('fetch', mockFetch);
    await fetchFlopNode('utgr_bbc', []);
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/utgr_bbc/flop_root.json`);
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

describe('fetchFlopNode — AbortSignal (Phase 4 new contract)', () => {
  it('rejects with AbortError when signal is aborted pre-call', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);
    await expect(fetchFlopNode('utgr_bbc', [], ctrl.signal)).rejects.toThrow(/Aborted/);
  });

  it('aborting mid-await rejects the caller without canceling underlying fetch', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    const fetchPromise = new Promise((res) => { resolveFetch = res; });
    const mockFetch = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal('fetch', mockFetch);

    const ctrl = new AbortController();
    const pending = fetchFlopNode('utgr_bbc', [], ctrl.signal);
    ctrl.abort();
    await expect(pending).rejects.toThrow(/Aborted/);

    // Underlying fetch was NOT aborted — resolving it should populate cache without error.
    resolveFetch({ ok: true, json: async () => ({ _meta: { variant: 'utgr_bbc' } }) });
    // Wait a microtask for the shared promise to settle.
    await new Promise((r) => setTimeout(r, 0));
    // A new caller now gets the cached result.
    const second = await fetchFlopNode('utgr_bbc', []);
    expect(second).toEqual({ _meta: { variant: 'utgr_bbc' } });
    // Only one fetch call was made (the original).
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT pass signal to the underlying fetch (signal is for caller-side only)', async () => {
    const ctrl = new AbortController();
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);
    await fetchFlopNode('utgr_bbc', [], ctrl.signal);
    // fetch is called with ONE arg (url only), not (url, {signal})
    expect(mockFetch).toHaveBeenCalledWith(expect.any(String));
    expect(mockFetch.mock.calls[0]).toHaveLength(1);
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

describe('fetchFlopNode — memoization (Phase 4)', () => {
  it('shares in-flight fetch across concurrent calls for the same URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _meta: { variant: 'utgr_bbc' } }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const [a, b, c] = await Promise.all([
      fetchFlopNode('utgr_bbc', []),
      fetchFlopNode('utgr_bbc', []),
      fetchFlopNode('utgr_bbc', []),
    ]);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('different URLs (different chains) are cached separately', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);
    await fetchFlopNode('utgr_bbc', []);
    await fetchFlopNode('utgr_bbc', ['bb_x']);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns cached result on second call without re-fetching', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _meta: { variant: 'utgr_bbc' } }),
    });
    vi.stubGlobal('fetch', mockFetch);
    await fetchFlopNode('utgr_bbc', []);
    await fetchFlopNode('utgr_bbc', []);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('drops cache entry on error so retry can succeed', async () => {
    let attempt = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.resolve({ ok: false, status: 503, statusText: 'Unavailable' });
      }
      return Promise.resolve({ ok: true, json: async () => ({ _meta: { variant: 'utgr_bbc' } }) });
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchFlopNode('utgr_bbc', [])).rejects.toThrow(/503/);
    // Retry should succeed because cache entry was dropped.
    const result = await fetchFlopNode('utgr_bbc', []);
    expect(result).toEqual({ _meta: { variant: 'utgr_bbc' } });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
