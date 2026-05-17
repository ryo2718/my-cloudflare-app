import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  classifyByBetRate,
  computeBetRate,
  computeBetRateFromNode,
  computeCBRate,
  computeDonkRate,
  enumerateMatchups,
  buildMatchupCell,
  loadFlopReportCell,
  DEFAULT_BET_RATE_THRESHOLDS,
  FLOP_REPORT_DEPTHS,
  REPORT_POSITIONS,
  type FlopReportDepth,
  type MatchupCell,
} from './flopReport';
import { clearFlopNodeCache } from '../hooks/useFlopNode';
import type {
  ActionSolution,
  ActionTotal,
  BoardSolution,
  FlopNode,
} from '../types/flop';

// ----------------------------------------------------------------------------
// Test helpers
// ----------------------------------------------------------------------------

/** ActionTotal / ActionSolution の最小コンストラクタ。 */
function at(code: string, freq: number): ActionTotal {
  return { action_code: code, frequency: freq, solved_action_count: 1755 };
}
function asol(code: string, freq: number): ActionSolution {
  return { action_code: code, frequency: freq };
}

/** Compute-only テスト用の最小 FlopNode。compute 側で参照するフィールドだけ実装。 */
function mockNode(
  totals: ActionTotal[],
  solutions: BoardSolution[] = [],
): FlopNode {
  return {
    _meta: {
      variant: 'test',
      flop_chain: '',
      action_chain: [],
      depth: 0,
      next_actor: 'bb',
      terminal_type: null,
      scraped_at: '2026-05-15T00:00:00Z',
    },
    status: 'done',
    custom_tree_id: null,
    solutions,
    players: [],
    action_totals: totals,
    filtered_action_totals: totals,
    player_totals: [],
    filtered_player_totals: [],
    filtered_ratio: 1.0,
    // game_point は compute 系では参照されないので、テスト用に空 cast。
    game_point: {} as unknown as FlopNode['game_point'],
    solved_board_count: null,
    total_board_count: null,
  };
}

function board(
  name: string,
  actions: ActionSolution[],
): BoardSolution {
  return { name, ratio: null, action_solutions: actions, player_solutions: [] };
}

// ----------------------------------------------------------------------------
// classifyByBetRate
// ----------------------------------------------------------------------------

describe('classifyByBetRate (default thresholds 0.8 / 0.5 / 0.2)', () => {
  it('null → "−" (データなし)', () => {
    expect(classifyByBetRate(null)).toBe('−');
  });

  it('境界値 0.20 → △ (inclusive lower bound)', () => {
    expect(classifyByBetRate(0.2)).toBe('△');
  });
  it('0.19 → × (≤ low 未満)', () => {
    expect(classifyByBetRate(0.19)).toBe('×');
  });
  it('0.21 → △', () => {
    expect(classifyByBetRate(0.21)).toBe('△');
  });

  it('境界値 0.50 → ○', () => {
    expect(classifyByBetRate(0.5)).toBe('○');
  });
  it('0.49 → △', () => {
    expect(classifyByBetRate(0.49)).toBe('△');
  });
  it('0.51 → ○', () => {
    expect(classifyByBetRate(0.51)).toBe('○');
  });

  it('境界値 0.80 → ◎', () => {
    expect(classifyByBetRate(0.8)).toBe('◎');
  });
  it('0.79 → ○', () => {
    expect(classifyByBetRate(0.79)).toBe('○');
  });
  it('0.81 → ◎', () => {
    expect(classifyByBetRate(0.81)).toBe('◎');
  });

  it('extremes: 0 → ×, 1 → ◎', () => {
    expect(classifyByBetRate(0)).toBe('×');
    expect(classifyByBetRate(1)).toBe('◎');
  });

  it('明示的にデフォルト thresholds を渡しても同じ結果', () => {
    expect(classifyByBetRate(0.5, DEFAULT_BET_RATE_THRESHOLDS)).toBe('○');
  });
});

describe('classifyByBetRate (custom thresholds)', () => {
  it('カスタム threshold で 0.4 → △', () => {
    const th = { high: 0.9, mid: 0.6, low: 0.3 };
    expect(classifyByBetRate(0.4, th)).toBe('△');
    expect(classifyByBetRate(0.3, th)).toBe('△');
    expect(classifyByBetRate(0.29, th)).toBe('×');
  });

  it('既存 classifyByPlayRate と混同しないよう 0-1 スケールが前提', () => {
    // 10/30/90 を 100 で割ったような閾値でも動く (旧 play-rate thresholds 互換)
    const th = { high: 0.9, mid: 0.3, low: 0.1 };
    expect(classifyByBetRate(0.5, th)).toBe('○');
    expect(classifyByBetRate(0.95, th)).toBe('◎');
  });
});

// ----------------------------------------------------------------------------
// computeBetRate
// ----------------------------------------------------------------------------

describe('computeBetRate (R* / RAI 合算)', () => {
  it('空配列 → 0', () => {
    expect(computeBetRate([])).toBe(0);
  });

  it('X / F / C のみ → 0', () => {
    expect(computeBetRate([at('X', 0.9), at('F', 0.05), at('C', 0.05)])).toBe(0);
  });

  it('単一 R<size> → そのまま返す', () => {
    expect(computeBetRate([at('R1.8', 0.42)])).toBeCloseTo(0.42, 10);
  });

  it('RAI も bet と判定 (R* と合算)', () => {
    const rate = computeBetRate([at('R1.8', 0.3), at('RAI', 0.1), at('X', 0.6)]);
    expect(rate).toBeCloseTo(0.4, 10);
  });

  it('複数 R<size> サイズ違いを合算', () => {
    const rate = computeBetRate([
      at('R1.8', 0.2),
      at('R3.5', 0.15),
      at('R6.35', 0.05),
      at('X', 0.6),
    ]);
    expect(rate).toBeCloseTo(0.4, 10);
  });

  it('ActionSolution 配列でも動く (per-board)', () => {
    expect(computeBetRate([asol('X', 0), asol('R1.8', 1), asol('RAI', 0)])).toBe(1);
  });
});

// ----------------------------------------------------------------------------
// computeBetRateFromNode / computeCBRate / computeDonkRate
// ----------------------------------------------------------------------------

describe('computeBetRateFromNode', () => {
  it('board=null → action_totals を集計', () => {
    const node = mockNode([at('X', 0.9), at('R1.8', 0.1)]);
    expect(computeBetRateFromNode(node, null)).toBeCloseTo(0.1, 10);
  });

  it('board 指定 → per-board solutions を集計', () => {
    const node = mockNode(
      [at('X', 0.9), at('R1.8', 0.1)],
      [
        board('2h2d2c', [asol('X', 0.5), asol('R1.8', 0.5)]),
        board('AsKsQs', [asol('X', 0.1), asol('R1.8', 0.9)]),
      ],
    );
    expect(computeBetRateFromNode(node, '2h2d2c')).toBeCloseTo(0.5, 10);
    expect(computeBetRateFromNode(node, 'AsKsQs')).toBeCloseTo(0.9, 10);
  });

  it('未知 board → action_totals に fallback', () => {
    const node = mockNode(
      [at('X', 0.8), at('R1.8', 0.2)],
      [board('2h2d2c', [asol('X', 1), asol('R1.8', 0)])],
    );
    expect(computeBetRateFromNode(node, '9c9d9h')).toBeCloseTo(0.2, 10);
  });
});

describe('computeCBRate / computeDonkRate', () => {
  it('computeCBRate は computeBetRateFromNode と等価 (action_totals)', () => {
    const node = mockNode([at('X', 0.7), at('R1.8', 0.3)]);
    expect(computeCBRate(node, null)).toBeCloseTo(0.3, 10);
  });

  it('computeDonkRate: donkApplicable=true → bet rate', () => {
    const node = mockNode([at('X', 0.95), at('R1.8', 0.05)]);
    expect(computeDonkRate(node, null, true)).toBeCloseTo(0.05, 10);
  });

  it('computeDonkRate: donkApplicable=false → null', () => {
    const node = mockNode([at('X', 0.5), at('R1.8', 0.5)]);
    expect(computeDonkRate(node, null, false)).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// buildMatchupCell
// ----------------------------------------------------------------------------

describe('buildMatchupCell', () => {
  it('utgr_bbc (SRP, UTG opens BB calls): aggressor=UTG, caller=BB, donk可', () => {
    const cell = buildMatchupCell('BB', 'UTG', 'srp');
    expect(cell.variant).toBe('utgr_bbc');
    expect(cell.aggressor).toBe('UTG');
    expect(cell.caller).toBe('BB');
    expect(cell.donkApplicable).toBe(true);
    expect(cell.cbApplicable).toBe(true);
    // aggressor=UTG=IP → CB は flop_bb_x.json
    expect(cell.cbNodeChain).toEqual(['bb_x']);
    // donk は root
    expect(cell.donkNodeChain).toEqual([]);
  });

  it('sbr_bbc (SRP, SB opens BB calls): aggressor=SB(OOP), donk不可', () => {
    const cell = buildMatchupCell('SB', 'BB', 'srp');
    expect(cell.variant).toBe('sbr_bbc');
    expect(cell.aggressor).toBe('SB');
    expect(cell.caller).toBe('BB');
    expect(cell.donkApplicable).toBe(false);
    expect(cell.cbApplicable).toBe(true);
    // aggressor=SB=OOP → CB は root
    expect(cell.cbNodeChain).toEqual([]);
    expect(cell.donkNodeChain).toBeNull();
  });

  it('utgr_btnc (SRP, UTG opens BTN calls): caller=BTN=IP → donk不可', () => {
    const cell = buildMatchupCell('UTG', 'BTN', 'srp');
    expect(cell.variant).toBe('utgr_btnc');
    expect(cell.aggressor).toBe('UTG');
    expect(cell.caller).toBe('BTN');
    expect(cell.donkApplicable).toBe(false);
    expect(cell.cbApplicable).toBe(true);
    // aggressor=UTG=OOP → CB は root
    expect(cell.cbNodeChain).toEqual([]);
    expect(cell.donkNodeChain).toBeNull();
  });

  it('utgr_bbr_utgc (3bp, UTG opens BB 3bets UTG calls): aggressor=BB(OOP), caller=UTG(IP)', () => {
    const cell = buildMatchupCell('BB', 'UTG', '3bp');
    expect(cell.variant).toBe('utgr_bbr_utgc');
    expect(cell.aggressor).toBe('BB');
    expect(cell.caller).toBe('UTG');
    expect(cell.donkApplicable).toBe(false);
    // aggressor=BB=OOP → CB は root
    expect(cell.cbNodeChain).toEqual([]);
  });

  it('utgr_hjr_utgc (3bp, UTG vs HJ): aggressor=HJ(IP), caller=UTG(OOP) → donk可', () => {
    const cell = buildMatchupCell('UTG', 'HJ', '3bp');
    expect(cell.variant).toBe('utgr_hjr_utgc');
    expect(cell.aggressor).toBe('HJ');
    expect(cell.caller).toBe('UTG');
    expect(cell.donkApplicable).toBe(true);
    // aggressor=HJ=IP → CB は flop_utg_x.json
    expect(cell.cbNodeChain).toEqual(['utg_x']);
    expect(cell.donkNodeChain).toEqual([]);
  });

  it('utgr_bbr_utgr22_bbc (4bp): opener=aggressor=UTG, caller=BB → donk可', () => {
    const cell = buildMatchupCell('BB', 'UTG', '4bp');
    expect(cell.variant).toBe('utgr_bbr_utgr22_bbc');
    expect(cell.aggressor).toBe('UTG');
    expect(cell.caller).toBe('BB');
    expect(cell.donkApplicable).toBe(true);
  });

  it('utgr_bbr_utgr_bbr34_utgc (5bp): aggressor=BB, caller=UTG → donk不可', () => {
    const cell = buildMatchupCell('BB', 'UTG', '5bp');
    expect(cell.variant).toBe('utgr_bbr_utgr_bbr34_utgc');
    expect(cell.aggressor).toBe('BB');
    expect(cell.caller).toBe('UTG');
    expect(cell.donkApplicable).toBe(false);
  });

  it('HJ-CO SRP は variant なし → 全フィールド null/false', () => {
    const cell = buildMatchupCell('HJ', 'CO', 'srp');
    expect(cell.variant).toBeNull();
    expect(cell.aggressor).toBeNull();
    expect(cell.caller).toBeNull();
    expect(cell.donkApplicable).toBe(false);
    expect(cell.cbApplicable).toBe(false);
    expect(cell.cbNodeChain).toBeNull();
    expect(cell.donkNodeChain).toBeNull();
  });

  it('SB-HJ 3bp も variant なし', () => {
    const cell = buildMatchupCell('SB', 'HJ', '3bp');
    expect(cell.variant).toBeNull();
  });

  it('oop === ip で throw', () => {
    expect(() => buildMatchupCell('BB', 'BB', 'srp')).toThrow();
  });
});

// ----------------------------------------------------------------------------
// enumerateMatchups
// ----------------------------------------------------------------------------

describe('enumerateMatchups', () => {
  it('15 cells (6 positions C 2) を depth ごとに返す', () => {
    for (const d of FLOP_REPORT_DEPTHS) {
      const cells = enumerateMatchups(d);
      expect(cells).toHaveLength(15);
    }
  });

  it('全 cell が postflop OOP-first で正規化されている', () => {
    const cells = enumerateMatchups('srp');
    for (const cell of cells) {
      // 同じ pair の (oop, ip) は postflop seating で OOP が先
      // 簡易チェック: pair に BB/SB が含まれる場合 OOP は BB か SB
      const pair = new Set([cell.oop, cell.ip]);
      if (pair.has('SB')) expect(cell.oop).toBe('SB');
      else if (pair.has('BB')) expect(cell.oop).toBe('BB');
    }
  });

  it('depth=srp: 12 variants 取得可、3 件 null (UTG-HJ, UTG-CO, HJ-CO)', () => {
    const cells = enumerateMatchups('srp');
    const variants = cells.map((c) => c.variant).filter((v): v is string => v !== null);
    expect(variants).toHaveLength(12);
    expect(variants).toContain('utgr_bbc');
    expect(variants).toContain('btnr_bbc');
    expect(variants).toContain('sbr_bbc');
    expect(variants).toContain('utgr_btnc');

    const nullPairs = cells.filter((c) => c.variant === null).map((c) => `${c.oop}-${c.ip}`);
    expect(nullPairs.sort()).toEqual(['HJ-CO', 'UTG-CO', 'UTG-HJ']);
  });

  it('depth=3bp: 14 variants (SB-HJ のみ null)', () => {
    const cells = enumerateMatchups('3bp');
    const nonNull = cells.filter((c) => c.variant !== null);
    expect(nonNull).toHaveLength(14);
    const nullPairs = cells.filter((c) => c.variant === null);
    expect(nullPairs).toHaveLength(1);
    expect(`${nullPairs[0].oop}-${nullPairs[0].ip}`).toBe('SB-HJ');
  });

  it('depth=4bp: 14 variants (SB-HJ のみ null)', () => {
    const cells = enumerateMatchups('4bp');
    const nonNull = cells.filter((c) => c.variant !== null);
    expect(nonNull).toHaveLength(14);
    const nullPairs = cells.filter((c) => c.variant === null);
    expect(nullPairs).toHaveLength(1);
    expect(`${nullPairs[0].oop}-${nullPairs[0].ip}`).toBe('SB-HJ');
  });

  it('depth=5bp: 3 variants のみ', () => {
    const cells = enumerateMatchups('5bp');
    const nonNull = cells.filter((c) => c.variant !== null);
    expect(nonNull).toHaveLength(3);
    expect(nonNull.map((c) => c.variant).sort()).toEqual([
      'cor_sbr_cor24_sbr40_coc',
      'utgr_bbr_utgr_bbr34_utgc',
      'utgr_sbr_utgr_sbr40_utgc',
    ]);
  });

  it('donkApplicable 集計 (SRP=8, 3bp=7, 4bp=7, 5bp=0)', () => {
    const expectedCounts: Record<FlopReportDepth, number> = {
      srp: 8,
      '3bp': 7,
      '4bp': 7,
      '5bp': 0,
    };
    for (const d of FLOP_REPORT_DEPTHS) {
      const cells = enumerateMatchups(d);
      const applicableCount = cells.filter((c) => c.donkApplicable).length;
      expect(applicableCount, `depth=${d}`).toBe(expectedCounts[d]);
    }
  });

  it('cbApplicable は variant の有無と一致', () => {
    for (const d of FLOP_REPORT_DEPTHS) {
      for (const cell of enumerateMatchups(d)) {
        expect(cell.cbApplicable).toBe(cell.variant !== null);
      }
    }
  });

  it('REPORT_POSITIONS は 6max 標準 (UTG/HJ/CO/BTN/SB/BB)', () => {
    expect([...REPORT_POSITIONS].sort()).toEqual(['BB', 'BTN', 'CO', 'HJ', 'SB', 'UTG']);
  });
});

// ----------------------------------------------------------------------------
// loadFlopReportCell (fetch mocked)
// ----------------------------------------------------------------------------

const BASE = 'https://example.r2.dev/data/flop/v1/cash_100bb';

beforeEach(() => {
  vi.stubEnv('VITE_FLOP_DATA_BASE_URL', BASE);
  // Phase 4 以降: fetchFlopNode は module-level でメモ化されているため、test 間で必ずクリア。
  clearFlopNodeCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearFlopNodeCache();
});

describe('loadFlopReportCell — aggressor=IP (donk + CB の 2 ノード fetch)', () => {
  it('utgr_bbc + srp: root と flop_bb_x.json を並列 fetch、両 rate を返す', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/utgr_bbc/flop_root.json')) {
        // root = donk decision by BB (caller=OOP)
        return Promise.resolve({
          ok: true,
          json: async () =>
            mockNode([at('X', 0.92), at('R1.8', 0.08), at('RAI', 0)]),
        });
      }
      if (url.endsWith('/utgr_bbc/flop_bb_x.json')) {
        // CB decision by UTG after BB checks
        return Promise.resolve({
          ok: true,
          json: async () =>
            mockNode([at('X', 0.3), at('R1.8', 0.7)]),
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await loadFlopReportCell('utgr_bbc', 'srp', null);

    expect(result.variant).toBe('utgr_bbc');
    expect(result.depth).toBe('srp');
    expect(result.board).toBeNull();
    expect(result.donkRate).toBeCloseTo(0.08, 10);
    expect(result.cbRate).toBeCloseTo(0.7, 10);
    expect(result.donkSymbol).toBe('×'); // 0.08 < 0.2
    expect(result.cbSymbol).toBe('○'); // 0.5 ≤ 0.7 < 0.8
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('カスタム thresholds が classifySymbol に反映', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNode([at('X', 0.4), at('R1.8', 0.6)]),
    }));
    // 0.6 を ◎ にする閾値 (high=0.5)
    const result = await loadFlopReportCell('utgr_bbc', 'srp', null, {
      high: 0.5,
      mid: 0.3,
      low: 0.1,
    });
    expect(result.donkSymbol).toBe('◎');
    expect(result.cbSymbol).toBe('◎');
  });
});

describe('loadFlopReportCell — aggressor=OOP (root 1 ノードのみ fetch、donk=null)', () => {
  it('sbr_bbc + srp: root のみ fetch、donkRate=null, donkSymbol="−"', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/sbr_bbc/flop_root.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockNode([at('X', 0.2), at('R1.8', 0.8)]),
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await loadFlopReportCell('sbr_bbc', 'srp', null);

    expect(result.donkRate).toBeNull();
    expect(result.donkSymbol).toBe('−');
    expect(result.cbRate).toBeCloseTo(0.8, 10);
    expect(result.cbSymbol).toBe('◎');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('utgr_bbr_utgc (3bp, aggressor=BB=OOP): root のみ fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNode([at('X', 0.55), at('R1.8', 0.45)]),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await loadFlopReportCell('utgr_bbr_utgc', '3bp', null);

    expect(result.donkRate).toBeNull();
    expect(result.cbRate).toBeCloseTo(0.45, 10);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/utgr_bbr_utgc/flop_root.json`,
    );
  });
});

describe('loadFlopReportCell — per-board', () => {
  it('board 指定時は solutions から bet rate を引く', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          mockNode(
            [at('X', 0.92), at('R1.8', 0.08)],
            [
              board('2h2d2c', [asol('X', 1), asol('R1.8', 0)]),
              board('AsKsQs', [asol('X', 0.1), asol('R1.8', 0.9)]),
            ],
          ),
      }),
    );

    const r1 = await loadFlopReportCell('sbr_bbc', 'srp', '2h2d2c');
    expect(r1.cbRate).toBeCloseTo(0, 10);
    expect(r1.board).toBe('2h2d2c');

    const r2 = await loadFlopReportCell('sbr_bbc', 'srp', 'AsKsQs');
    expect(r2.cbRate).toBeCloseTo(0.9, 10);
  });
});

describe('loadFlopReportCell — エラー系', () => {
  it('variant と (positions, depth) が一致しないと throw', async () => {
    // utgr_bbc は SRP の variant、depth=3bp で渡すと cell.variant=utgr_bbr_utgc になり mismatch
    await expect(loadFlopReportCell('utgr_bbc', '3bp', null)).rejects.toThrow(
      /Variant mismatch/,
    );
  });
});

describe('整合性: FLOP_REPORT_DEPTHS は limp を含まない', () => {
  it('limp は flop レポート対象外', () => {
    expect((FLOP_REPORT_DEPTHS as string[]).includes('limp')).toBe(false);
    expect([...FLOP_REPORT_DEPTHS].sort()).toEqual(['3bp', '4bp', '5bp', 'srp']);
  });
});

describe('caller=opener=aggressor の例外的なケースが起きないこと (sanity check)', () => {
  it('全 variant cell で aggressor !== caller', () => {
    for (const d of FLOP_REPORT_DEPTHS) {
      for (const cell of enumerateMatchups(d)) {
        if (cell.variant === null) continue;
        expect(cell.aggressor, `${cell.variant}`).not.toBe(cell.caller);
      }
    }
  });

  it('全 variant cell で donkApplicable === (caller === oop)', () => {
    for (const d of FLOP_REPORT_DEPTHS) {
      for (const cell of enumerateMatchups(d)) {
        if (cell.variant === null) continue;
        const expected = cell.caller === cell.oop;
        expect(cell.donkApplicable, `${cell.variant}`).toBe(expected);
      }
    }
  });

  it('cbNodeChain の形式: aggressor=OOP は [], aggressor=IP は ["<oop>_x"]', () => {
    for (const d of FLOP_REPORT_DEPTHS) {
      for (const cell of enumerateMatchups(d)) {
        if (cell.variant === null) continue;
        if (cell.aggressor === cell.oop) {
          expect(cell.cbNodeChain, `${cell.variant}`).toEqual([]);
        } else {
          expect(cell.cbNodeChain, `${cell.variant}`).toEqual([
            `${cell.oop.toLowerCase()}_x`,
          ]);
        }
      }
    }
  });
});

// 型インポート確認 (compile-time only — ランタイム影響なし)
const _typeCheck: MatchupCell | null = null;
void _typeCheck;
