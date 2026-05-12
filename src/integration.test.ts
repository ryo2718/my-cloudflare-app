// Phase 6 統合テスト: 複数モジュール跨ぎの主要フロー検証。
//
// 単体テストでは検証しづらい「pipeline 全体の整合性」を確認する:
//  - 正準化 + Map lookup の往復が安定
//  - chain 進行 (encodeStep → chainToFilename) → fetch URL 組立が一貫
//  - getFlopVariantFromPreflopNode との連携 (Phase 6 連携入口)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isoSignature,
  parseBoardName,
} from './utils/flopBoardCanonical';
import {
  chainToFilename,
  encodeStep,
  filenameToChain,
  hasAggressionInChain,
} from './data/flopChain';
import {
  FLOP_VARIANTS,
  getDefaultFlopVariantFromPreflopNode,
  getFlopOpener,
  getFlopCaller,
  getFlopResponder,
  getPotDepth,
} from './data/flopVariants';
import { fetchFlopNode } from './hooks/useFlopNode';

// ----------------------------------------------------------------------------
// Iso signature + canonical map 整合性
// ----------------------------------------------------------------------------

describe('integration: isoSignature ↔ Map<sig, board>', () => {
  // 主要 iso class の代表ボード名を embed (実 JSON から抜粋した 12 件)。
  // 1,755 件全部の検証は flopBoardCanonical の sanity check で網羅、ここは
  // 「signature を使った Map で lookup が機能する」ことの統合確認。
  const sampleBoards = [
    '2h2d2c', '3h2h2d', '3h2d2c', '3d3c2h', '3h3d3c',
    'AhKhQh', 'AhKhQd', 'AhKdQc', 'KhKd5c', 'KhKd5h',
    'TsJsQs', '9s9h5h',
  ];

  it('全 sample が distinct signature を持つ', () => {
    const sigs = new Set<string>();
    for (const name of sampleBoards) {
      sigs.add(isoSignature(parseBoardName(name)));
    }
    expect(sigs.size).toBe(sampleBoards.length);
  });

  it('Map<sig, board> で正準名 → 自身が引ける', () => {
    const map = new Map<string, string>();
    for (const name of sampleBoards) {
      map.set(isoSignature(parseBoardName(name)), name);
    }
    for (const name of sampleBoards) {
      const sig = isoSignature(parseBoardName(name));
      expect(map.get(sig)).toBe(name);
    }
  });

  it('iso 同型な別カード列でも同 Map エントリに到達', () => {
    const map = new Map<string, string>();
    for (const name of sampleBoards) {
      map.set(isoSignature(parseBoardName(name)), name);
    }
    // "AhKhQh" の suit 全 swap (各 suit→別 suit に置換)
    const equivalent = parseBoardName('AsKsQs'); // monotone, same iso class
    expect(map.get(isoSignature(equivalent))).toBe('AhKhQh');

    // "AhKdQc" のスート組替 (rainbow)
    const rainbowEquiv = parseBoardName('AsKhQd');
    expect(map.get(isoSignature(rainbowEquiv))).toBe('AhKdQc');
  });
});

// ----------------------------------------------------------------------------
// Chain encode → filename → decode 往復
// ----------------------------------------------------------------------------

describe('integration: encodeStep + chainToFilename + filenameToChain', () => {
  it('簡単な flow: empty → bet → raise → all-in', () => {
    // 想定 flow: root → BB bets 1.8 → UTG raises 6.35 → BB all-in
    const chain: string[] = [];

    chain.push(encodeStep('bb', 'R1.8', false));
    chain.push(encodeStep('utg', 'R6.35', true)); // already aggressive
    chain.push(encodeStep('bb', 'RAI', true));

    expect(chain).toEqual(['bb_b1_8', 'utg_r6_35', 'bb_rAI']);

    const fname = chainToFilename('utgr_bbc', chain);
    expect(fname).toBe('flop_bb_b1_8_utg_r6_35_bb_rAI.json');

    expect(filenameToChain(fname)).toEqual(chain);
  });

  it('check + check (passive only)', () => {
    const chain: string[] = [];
    chain.push(encodeStep('bb', 'X', false));
    chain.push(encodeStep('utg', 'X', false));
    // 両方とも passive、まだ aggressive 入ってない

    expect(hasAggressionInChain(chain)).toBe(false);

    const fname = chainToFilename('utgr_bbc', chain);
    expect(fname).toBe('flop_bb_x_utg_x.json');
    expect(filenameToChain(fname)).toEqual(chain);
  });

  it('hasAggressionInChain が encodeStep の判定材料として正しく機能', () => {
    const chain: string[] = [];
    // step 1: BB が check
    expect(hasAggressionInChain(chain)).toBe(false);
    chain.push(encodeStep('bb', 'X', hasAggressionInChain(chain)));

    // step 2: UTG が bet (first agg なので b prefix)
    expect(hasAggressionInChain(chain)).toBe(false);
    chain.push(encodeStep('utg', 'R1.8', hasAggressionInChain(chain)));

    // step 3: BB が raise (already agg なので r prefix)
    expect(hasAggressionInChain(chain)).toBe(true);
    chain.push(encodeStep('bb', 'R6.35', hasAggressionInChain(chain)));

    expect(chain).toEqual(['bb_x', 'utg_b1_8', 'bb_r6_35']);
  });
});

// ----------------------------------------------------------------------------
// Preflop → Flop variant 導出 (Phase 6 連携入口)
// ----------------------------------------------------------------------------

describe('integration: preflop nodePath → flop variant 連携', () => {
  it('SRP 各 opener × responder の組合せで variant が取れる', () => {
    const cases: Array<[string, string]> = [
      ['utgr_bb', 'utgr_bbc'],
      ['hjr_bb', 'hjr_bbc'],
      ['cor_btn', 'cor_btnc'],
      ['btnr_sb', 'btnr_sbc'],
      ['sbr_bb', 'sbr_bbc'],
    ];
    for (const [preflop, expectedFlop] of cases) {
      expect(getDefaultFlopVariantFromPreflopNode(preflop)).toBe(expectedFlop);
    }
  });

  it('3bp 全ライン', () => {
    expect(getDefaultFlopVariantFromPreflopNode('utgr_bbr_utg')).toBe('utgr_bbr_utgc');
    expect(getDefaultFlopVariantFromPreflopNode('cor_btnr_co')).toBe('cor_btnr_coc');
    expect(getDefaultFlopVariantFromPreflopNode('sbr_bbr_sb')).toBe('sbr_bbr_sbc');
  });

  it('limp 系: ambiguous は最小サイズ', () => {
    expect(getDefaultFlopVariantFromPreflopNode('sbc_bbr_sb')).toBe('sbc_bbr3_sbc');
  });

  it('allin terminal は flop なし', () => {
    expect(getDefaultFlopVariantFromPreflopNode('utgr_bbai_bb')).toBeNull();
  });

  it('対応する variant が FLOP_VARIANTS に確実に存在', () => {
    // 全 preflop terminal samples で、出力 variant が manifest に含まれることを確認
    const samples = ['utgr_bb', 'cor_btn', 'sbc_bb', 'utgr_bbr_utg', 'sbc_bbr_sb', 'utgr_bbr_utgr_bb'];
    for (const np of samples) {
      const v = getDefaultFlopVariantFromPreflopNode(np);
      if (v !== null) {
        expect(FLOP_VARIANTS.has(v)).toBe(true);
      }
    }
  });

  it('variant から (opener, responder, depth) を取り出すと preflop nodePath と整合', () => {
    // SRP: utgr_bb → utgr_bbc → opener=UTG, responder=BB, depth=SRP
    let v = getDefaultFlopVariantFromPreflopNode('utgr_bb')!;
    expect(getFlopOpener(v)).toBe('UTG');
    expect(getFlopResponder(v)).toBe('BB');
    expect(getPotDepth(v)).toBe('SRP');
    expect(getFlopCaller(v)).toBe('BB'); // SRP では caller === responder

    // 3bp: caller は opener 側 (UTG が BB の 3-bet に call)
    v = getDefaultFlopVariantFromPreflopNode('utgr_bbr_utg')!;
    expect(getFlopOpener(v)).toBe('UTG');
    expect(getFlopResponder(v)).toBe('BB');
    expect(getPotDepth(v)).toBe('3bp');
    expect(getFlopCaller(v)).toBe('UTG'); // 3bp で caller flip
  });
});

// ----------------------------------------------------------------------------
// fetchFlopNode + chainToFilename: 完全 URL 組立 (mock fetch)
// ----------------------------------------------------------------------------

describe('integration: fetchFlopNode の URL 組立 chain advance', () => {
  const BASE = 'https://example.r2.dev/data/flop/v1/cash_100bb';

  beforeEach(() => {
    vi.stubEnv('VITE_FLOP_DATA_BASE_URL', BASE);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('chain 進行に応じて URL が変わる (root → bet → raise → allin)', async () => {
    const calls: string[] = [];
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ _meta: { variant: 'utgr_bbc' } }),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // chain を 1 step ずつ進めて fetch
    await fetchFlopNode('utgr_bbc', []);
    await fetchFlopNode('utgr_bbc', ['bb_b1_8']);
    await fetchFlopNode('utgr_bbc', ['bb_b1_8', 'utg_r6_35']);
    await fetchFlopNode('utgr_bbc', ['bb_b1_8', 'utg_r6_35', 'bb_rAI']);

    expect(calls).toEqual([
      `${BASE}/utgr_bbc/flop_root.json`,
      `${BASE}/utgr_bbc/flop_bb_b1_8.json`,
      `${BASE}/utgr_bbc/flop_bb_b1_8_utg_r6_35.json`,
      `${BASE}/utgr_bbc/flop_bb_b1_8_utg_r6_35_bb_rAI.json`,
    ]);
  });

  it('variant 切替で正しい directory に URL が変わる', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        calls.push(url);
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }),
    );

    await fetchFlopNode('utgr_bbc', []);
    await fetchFlopNode('btnr_bbc', []);
    await fetchFlopNode('sbc_bb', []);

    expect(calls).toEqual([
      `${BASE}/utgr_bbc/flop_root.json`,
      `${BASE}/btnr_bbc/flop_root.json`,
      `${BASE}/sbc_bb/flop_root.json`,
    ]);
  });
});
