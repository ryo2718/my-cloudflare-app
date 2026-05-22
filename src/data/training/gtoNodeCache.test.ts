import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadNodeHands, cachedNodeHands, __testing__ } from './gtoNodeCache';

const HANDS = { AA: { allin: 0, raise: 100, call: 0, fold: 0 }, '72o': { allin: 0, raise: 0, call: 0, fold: 100 } };

beforeEach(() => {
  __testing__.reset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  __testing__.reset();
});

describe('gtoNodeCache', () => {
  it('未取得は fetch して hands を返す', async () => {
    let calledUrl = '';
    const fetchMock = vi.fn(async (url: string) => {
      calledUrl = url;
      return { ok: true, status: 200, json: async () => ({ hands: HANDS }) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const hands = await loadNodeHands('utg.json');
    expect(hands).toEqual(HANDS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 正しいパスを叩く
    expect(calledUrl).toContain('/data/preflop/cash_100bb_6max_nl500_2.5x/utg.json');
  });

  it('2回目はキャッシュヒットで fetch しない (同一参照)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hands: HANDS }) }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const a = await loadNodeHands('utg.json');
    const b = await loadNodeHands('utg.json');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(b).toBe(a); // 同一参照
    expect(cachedNodeHands('utg.json')).toBe(a);
  });

  it('!ok は throw し、キャッシュに残さない', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as unknown as Response));
    await expect(loadNodeHands('missing.json')).rejects.toThrow();
    expect(cachedNodeHands('missing.json')).toBeUndefined();
  });

  it('cachedNodeHands は未取得なら undefined', () => {
    expect(cachedNodeHands('never.json')).toBeUndefined();
  });
});
