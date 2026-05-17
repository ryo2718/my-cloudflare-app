import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  preloadFlopReports,
  PRELOAD_CONCURRENCY,
} from './useFlopReportPreload';
import { clearFlopNodeCache } from './useFlopNode';

const BASE = 'https://example.r2.dev/data/flop/v1/cash_100bb';

beforeEach(() => {
  vi.stubEnv('VITE_FLOP_DATA_BASE_URL', BASE);
  clearFlopNodeCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearFlopNodeCache();
});

/** 全 fetch を成功させる軽量 mock。FlopNode 風の最小オブジェクトを返す。 */
function installSuccessMock(): { fetchSpy: ReturnType<typeof vi.fn>; minNode: object } {
  const minNode = {
    _meta: {
      variant: 'test',
      flop_chain: '',
      action_chain: [],
      depth: 0,
      next_actor: 'bb',
      terminal_type: null,
      scraped_at: '2026-05-15',
    },
    status: 'done',
    custom_tree_id: null,
    solutions: [{ name: '2h2d2c', ratio: null, action_solutions: [], player_solutions: [] }],
    players: [
      { position: 'BB', is_hero: false, relative_position: 'OOP', profile: null },
      { position: 'UTG', is_hero: false, relative_position: 'IP', profile: null },
    ],
    action_totals: [{ action_code: 'X', frequency: 0.9, solved_action_count: 1755 }],
    filtered_action_totals: [],
    player_totals: [],
    filtered_player_totals: [],
    filtered_ratio: 1.0,
    game_point: {},
    solved_board_count: null,
    total_board_count: null,
  };
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => minNode,
  });
  vi.stubGlobal('fetch', fetchSpy);
  return { fetchSpy, minNode };
}

describe('PRELOAD_CONCURRENCY', () => {
  it('並列上限はコメント仕様と一致 (= 8)', () => {
    expect(PRELOAD_CONCURRENCY).toBe(8);
  });
});

describe('preloadFlopReports — happy path', () => {
  it('全 43 variant × 1〜2 fetch ≈ 60+ unique URL を fetch する', async () => {
    const { fetchSpy } = installSuccessMock();
    const ctrl = new AbortController();
    const result = await preloadFlopReports(null, ctrl.signal);

    // variant 数: SRP 12 + 3bp 14 + 4bp 14 + 5bp 3 = 43
    expect(result.total).toBe(43);
    expect(result.aborted).toBe(false);
    // 各 variant で 1〜2 fetch (aggressor=IP は root + flop_<oop>_x.json の 2 件)
    // 最低 43 件、最大 86 件。実観測値は variant 半数くらいが aggressor=IP。
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(43);
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(86);
  });

  it('全 task が成功すれば succeeded=total, failed=0', async () => {
    installSuccessMock();
    const ctrl = new AbortController();
    const result = await preloadFlopReports(null, ctrl.signal);
    expect(result.succeeded).toBe(result.total);
    expect(result.failed).toBe(0);
  });

  it('2 回目の呼び出しは cache hit で fetch 0 件 (memoization が効いている)', async () => {
    const { fetchSpy } = installSuccessMock();
    const ctrl = new AbortController();
    await preloadFlopReports(null, ctrl.signal);
    const firstCallCount = fetchSpy.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // 2 回目: 同じ URL なので fetchFlopNode cache hit → fetch 呼ばれない
    await preloadFlopReports(null, ctrl.signal);
    expect(fetchSpy.mock.calls.length).toBe(firstCallCount);
  });

  it('board 変更しても fetch 数は不変 (URL は board に依存しない)', async () => {
    const { fetchSpy } = installSuccessMock();
    const ctrl = new AbortController();
    await preloadFlopReports(null, ctrl.signal);
    const after1st = fetchSpy.mock.calls.length;

    await preloadFlopReports('AsKsQs', ctrl.signal);
    expect(fetchSpy.mock.calls.length).toBe(after1st);
  });
});

describe('preloadFlopReports — concurrency limit', () => {
  it('同時 in-flight 数が PRELOAD_CONCURRENCY × 2 を超えない (1 task = 1〜2 fetch)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const fakeNode = {
      _meta: { variant: 'test', flop_chain: '', action_chain: [], depth: 0, next_actor: 'bb', terminal_type: null, scraped_at: '' },
      status: 'done',
      custom_tree_id: null,
      solutions: [],
      players: [],
      action_totals: [{ action_code: 'X', frequency: 1, solved_action_count: 1755 }],
      filtered_action_totals: [],
      player_totals: [],
      filtered_player_totals: [],
      filtered_ratio: 1,
      game_point: {},
      solved_board_count: null,
      total_board_count: null,
    };

    // 各 fetch は in-flight をインクリメント → microtask yield → デクリメントして resolve。
    // 多くの worker が同時に動くと maxInFlight が増える。並列上限が効いていれば <= 16。
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        // 数 microtask 分待つ (= 他 worker が in-flight に入る余地を作る)
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
        inFlight--;
        return { ok: true, json: async () => fakeNode };
      }),
    );

    const ctrl = new AbortController();
    await preloadFlopReports(null, ctrl.signal);

    // 1 task = 内部で 1〜2 fetch を Promise.all で並列発射するため、
    // 上限は PRELOAD_CONCURRENCY × 2 = 16 を超えない。
    expect(maxInFlight).toBeGreaterThan(0);
    expect(maxInFlight).toBeLessThanOrEqual(PRELOAD_CONCURRENCY * 2);
  });
});

describe('preloadFlopReports — abort handling', () => {
  it('preload 中に signal.abort() で残タスクが走らない', async () => {
    const pendingResolvers: Array<() => void> = [];
    const fetchSpy = vi.fn().mockImplementation(() =>
      new Promise((resolve) => {
        pendingResolvers.push(() =>
          resolve({
            ok: true,
            json: async () => ({
              _meta: { variant: 'test', flop_chain: '', action_chain: [], depth: 0, next_actor: 'bb', terminal_type: null, scraped_at: '' },
              status: 'done',
              custom_tree_id: null,
              solutions: [],
              players: [],
              action_totals: [{ action_code: 'X', frequency: 1, solved_action_count: 1755 }],
              filtered_action_totals: [],
              player_totals: [],
              filtered_player_totals: [],
              filtered_ratio: 1,
              game_point: {},
              solved_board_count: null,
              total_board_count: null,
            }),
          }),
        );
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const ctrl = new AbortController();
    const preloadPromise = preloadFlopReports(null, ctrl.signal);
    // 並列 fire まで一拍待つ
    await new Promise((r) => setTimeout(r, 0));
    const beforeAbort = fetchSpy.mock.calls.length;
    ctrl.abort();
    // 在 in-flight を全部 resolve
    for (const r of pendingResolvers.splice(0)) r();
    const result = await preloadPromise;

    expect(result.aborted).toBe(true);
    // abort 後は新規 fetch が発火しない。abort 時点の起動数 + α (race 1 周分) 程度。
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(beforeAbort + PRELOAD_CONCURRENCY * 2);
  });
});

describe('preloadFlopReports — error tolerance', () => {
  it('fetch 失敗は silent (preloadResult.failed カウントに反映、全体は完走)', async () => {
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        n++;
        // 5 件に 1 件 fail
        if (n % 5 === 0) {
          return Promise.resolve({ ok: false, status: 500, statusText: 'Error' });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            _meta: { variant: 'test', flop_chain: '', action_chain: [], depth: 0, next_actor: 'bb', terminal_type: null, scraped_at: '' },
            status: 'done',
            custom_tree_id: null,
            solutions: [],
            players: [],
            action_totals: [{ action_code: 'X', frequency: 1, solved_action_count: 1755 }],
            filtered_action_totals: [],
            player_totals: [],
            filtered_player_totals: [],
            filtered_ratio: 1,
            game_point: {},
            solved_board_count: null,
            total_board_count: null,
          }),
        });
      }),
    );

    const ctrl = new AbortController();
    const result = await preloadFlopReports(null, ctrl.signal);
    expect(result.total).toBe(43);
    expect(result.succeeded + result.failed).toBe(result.total);
    expect(result.failed).toBeGreaterThan(0);
  });
});
