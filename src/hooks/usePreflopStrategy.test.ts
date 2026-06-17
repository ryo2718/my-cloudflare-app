import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPreflopNode, fetchPreflopIndex, clearPreflopCache } from './usePreflopStrategy';

const BASE = 'https://example.test/data/preflop/v1';

function mockOk(body: unknown) {
  return vi.fn(async () => ({ ok: true, json: async () => body }) as unknown as Response);
}

describe('fetchPreflopNode / fetchPreflopIndex', () => {
  beforeEach(() => {
    clearPreflopCache();
    vi.stubEnv('VITE_PREFLOP_DATA_BASE_URL', BASE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('builds the node URL as <base>/<config>/by_chain/<stem>.json', async () => {
    const fetchMock = mockOk({ hands: {} });
    vi.stubGlobal('fetch', fetchMock);
    await fetchPreflopNode('cash_100bb_6max_nl500_gto', 'F_F_F');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/cash_100bb_6max_nl500_gto/by_chain/F_F_F.json`,
    );
  });

  it('builds the index URL as <base>/<config>/index.json', async () => {
    const fetchMock = mockOk({ nodes: {} });
    vi.stubGlobal('fetch', fetchMock);
    await fetchPreflopIndex('cash_20bb_6max_nl500_gto');
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/cash_20bb_6max_nl500_gto/index.json`);
  });

  it('memoizes the same URL (second call does not refetch)', async () => {
    const fetchMock = mockOk({ hands: {} });
    vi.stubGlobal('fetch', fetchMock);
    await fetchPreflopNode('c', 'root');
    await fetchPreflopNode('c', 'root');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on non-ok response and allows retry (cache cleared)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found' }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPreflopNode('c', 'missing')).rejects.toThrow(/404/);
    // failed entry removed -> retry attempts a second fetch
    await expect(fetchPreflopNode('c', 'missing')).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when VITE_PREFLOP_DATA_BASE_URL is unset', async () => {
    vi.stubEnv('VITE_PREFLOP_DATA_BASE_URL', '');
    vi.stubGlobal('fetch', mockOk({}));
    await expect(fetchPreflopNode('c', 'root')).rejects.toThrow(/VITE_PREFLOP_DATA_BASE_URL/);
  });
});
