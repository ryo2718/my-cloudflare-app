import { describe, it, expect } from 'vitest';
import { normalize, type RawStrategyFile } from './normalize';

// ---------------------------------------------------------------------------
// 最小限の RawStrategyFile fixture を毎回その場で作る (実 JSON は読まない)。
// テスト対象は normalize の純関数挙動なので、game_info は最小限で十分。
// ---------------------------------------------------------------------------
function makeRaw(overrides: Partial<RawStrategyFile> = {}): RawStrategyFile {
  const base: RawStrategyFile = {
    game_info: {
      scenario: 'test',
      node_path: 'utg',
      step: 1,
      hero_position: 'UTG',
      active_positions: ['UTG'],
      folded_positions: [],
      action_history: [],
      is_leaf: false,
      available_actions_at_this_node: ['Allin', 'Raise', 'Call', 'Fold'],
      solution: { stack: '100bb', players: '6max' },
    },
    actions_legend: {},
    hands: {},
  };
  return { ...base, ...overrides };
}

describe('normalize', () => {
  describe('strategy 配列の組み立て (fold/call/raise/allin の順)', () => {
    it('check 無しのハンドは [fold, call, raise, allin] そのまま', () => {
      const raw = makeRaw({
        hands: {
          AA: { fold: 0, call: 0, raise: 100, allin: 0 },
          22: { fold: 71, call: 0, raise: 29, allin: 0 },
        },
      });
      const out = normalize(raw, 'test');
      expect(out.strategy.AA).toEqual([0, 0, 1.0, 0]);
      expect(out.strategy['22']).toEqual([0.71, 0, 0.29, 0]);
    });

    it('正常な ratio (合計 ~1) で出力される', () => {
      const raw = makeRaw({
        hands: { TT: { fold: 50, call: 30, raise: 15, allin: 5 } },
      });
      const out = normalize(raw, 'test');
      const arr = out.strategy.TT!;
      const sum = arr.reduce((s, x) => s + x, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe('check フィールドの扱い (sbc_bb 専用ケース — 回帰テスト)', () => {
    // commit 5c0ebcb で導入された check → call スロット合算の回帰防止。
    // 「Check は緑 (call と同じ passive 系)」を保証。「Check は青 (fold)」だと NG。

    it('check は call スロットに合算される (fold ではない)', () => {
      const raw = makeRaw({
        hands: { '72o': { fold: 0, call: 0, raise: 0, allin: 0, check: 100 } },
      });
      const out = normalize(raw, 'test');
      // [fold, call, raise, allin]
      expect(out.strategy['72o']).toEqual([0, 1.0, 0, 0]);
      //                                    ↑    ↑
      //                                    fold call(=check)
    });

    it('check と raise の mix も sum=1 で正しく入る', () => {
      const raw = makeRaw({
        hands: { '22': { fold: 0, call: 0, raise: 14.5, allin: 0, check: 85.5 } },
      });
      const out = normalize(raw, 'test');
      const arr = out.strategy['22']!;
      expect(arr[0]).toBe(0); // fold
      expect(arr[1]).toBeCloseTo(0.855, 5); // call (= check)
      expect(arr[2]).toBeCloseTo(0.145, 5); // raise
      expect(arr[3]).toBe(0); // allin
    });

    it('既存 call と check が両方ある仮想ケース: 両方 call スロットに合算', () => {
      // 実データには無い組合せだが、ロジックの代数的な正しさを確認
      const raw = makeRaw({
        hands: { '32o': { fold: 0, call: 30, raise: 0, allin: 0, check: 70 } },
      });
      const out = normalize(raw, 'test');
      expect(out.strategy['32o']![1]).toBeCloseTo(1.0, 5); // call スロット = 30 + 70
    });

    it('check が undefined の場合 (既存 127 ノード) は fold/call が変化しない', () => {
      const raw = makeRaw({
        hands: { AA: { fold: 0, call: 0, raise: 100, allin: 0 } },
      });
      const out = normalize(raw, 'test');
      expect(out.strategy.AA).toEqual([0, 0, 1.0, 0]);
    });
  });

  describe('FIXED_ACTIONS', () => {
    it('actions は fold/call/raise/allin の 4 種類で固定', () => {
      const raw = makeRaw({ hands: { AA: { fold: 0, call: 0, raise: 100, allin: 0 } } });
      const out = normalize(raw, 'test');
      expect(out.actions.map((a) => a.id)).toEqual(['fold', 'call', 'raise', 'allin']);
    });
  });

  describe('空ハンドはエラー', () => {
    it('hands が空ならスローする', () => {
      const raw = makeRaw({ hands: {} });
      expect(() => normalize(raw, 'test')).toThrow();
    });
  });
});
