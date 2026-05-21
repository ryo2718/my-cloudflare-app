import { describe, it, expect } from 'vitest';
import { paintCell, ACTION_BG, hasCheckAction } from './HandRangeMatrix.helpers';

describe('paintCell (check 対応 / BB vs SB limp バグ修正)', () => {
  it('100% check は cream(null) ではなく check 色のセル', () => {
    const segs = paintCell({ allin: 0, raise: 0, call: 0, check: 100, fold: 0 }).segments;
    expect(segs).toHaveLength(1);
    expect(segs![0].color).toBe(ACTION_BG.check);
    expect(segs![0].ratio).toBeCloseTo(100, 5);
  });

  it('混合 (raise 40.5 / check 59.5) は raise + check の分割塗り', () => {
    const segs = paintCell({ allin: 0, raise: 40.5, call: 0, check: 59.5, fold: 0 }).segments!;
    expect(segs.map((s) => s.color)).toEqual([ACTION_BG.raise, ACTION_BG.check]);
    expect(segs[0].ratio).toBeCloseTo(40.5, 5);
    expect(segs[1].ratio).toBeCloseTo(59.5, 5);
  });

  it('raise 100% は赤一色 (AA 等)', () => {
    const segs = paintCell({ allin: 0, raise: 100, call: 0, check: 0, fold: 0 }).segments!;
    expect(segs.map((s) => s.color)).toEqual([ACTION_BG.raise]);
  });

  it('通常ノード (check 無し) は従来どおり call+fold の分割塗り (デグレなし)', () => {
    const segs = paintCell({ allin: 0, raise: 0, call: 58.1, fold: 41.9 }).segments!;
    expect(segs.map((s) => s.color)).toEqual([ACTION_BG.call, ACTION_BG.fold]);
  });

  it('全戦略 0% (レンジ外) は null (クリーム)', () => {
    expect(paintCell({ allin: 0, raise: 0, call: 0, fold: 0 }).segments).toBeNull();
    expect(paintCell(undefined).segments).toBeNull();
  });

  it('ACTION_BG に全アクション (allin/raise/call/check/fold) が定義済み', () => {
    for (const a of ['allin', 'raise', 'call', 'check', 'fold']) {
      expect(typeof ACTION_BG[a]).toBe('string');
    }
  });

  it('check の色は call と同色 (緑 #639922)', () => {
    expect(ACTION_BG.check).toBe(ACTION_BG.call);
    expect(ACTION_BG.check).toBe('#639922');
  });

  it('hasCheckAction: check を持つノードのみ true', () => {
    expect(hasCheckAction({ AA: { allin: 0, raise: 0, call: 0, check: 100, fold: 0 } })).toBe(true);
    expect(hasCheckAction({ AA: { allin: 0, raise: 100, call: 0, fold: 0 } })).toBe(false);
  });
});
