import { describe, it, expect } from 'vitest';
import {
  FLOP_VARIANTS,
  FLOP_CONFIG,
  isAvailableFlopVariant,
  getPotDepth,
  getFlopOpener,
  getFlopCaller,
  getFlopResponder,
  getFlopVariantFromPreflopNode,
  getDefaultFlopVariantFromPreflopNode,
  findFlopVariants,
  findFlopVariantFromUI,
  reverseEngineerVariantToUI,
  type PreflopBucket,
} from './flopVariants';
import type { Position } from '../types/strategy';

describe('FLOP_VARIANTS manifest', () => {
  it('contains exactly 45 variants', () => {
    expect(FLOP_VARIANTS.size).toBe(45);
  });

  it('FLOP_CONFIG points to the single supported config', () => {
    expect(FLOP_CONFIG).toBe('cash_100bb_6max_nl500_2.5x');
  });

  it('includes representative variants from each opener', () => {
    expect(FLOP_VARIANTS.has('utgr_bbc')).toBe(true);
    expect(FLOP_VARIANTS.has('btnr_bbc')).toBe(true);
    expect(FLOP_VARIANTS.has('sbc_bb')).toBe(true);
    expect(FLOP_VARIANTS.has('hjr_bbc')).toBe(true);
    expect(FLOP_VARIANTS.has('cor_btnc')).toBe(true);
  });
});

describe('isAvailableFlopVariant', () => {
  it('returns true for known variants', () => {
    expect(isAvailableFlopVariant('utgr_bbc')).toBe(true);
    expect(isAvailableFlopVariant('sbc_bb')).toBe(true);
  });

  it('returns false for unknown variants', () => {
    expect(isAvailableFlopVariant('foo_bar')).toBe(false);
    expect(isAvailableFlopVariant('')).toBe(false);
    // preflop-style node_path (no flop variant by this exact name)
    expect(isAvailableFlopVariant('utgr_bb')).toBe(false);
  });
});

describe('getPotDepth', () => {
  it('classifies limp (0 aggressions)', () => {
    expect(getPotDepth('sbc_bb')).toBe('limp');
  });

  it('classifies SRP (1 aggression) — open + call', () => {
    expect(getPotDepth('utgr_bbc')).toBe('SRP');
    expect(getPotDepth('btnr_bbc')).toBe('SRP');
    expect(getPotDepth('sbr_bbc')).toBe('SRP');
  });

  it('classifies SRP for limp + iso (1 aggression on limp tree)', () => {
    expect(getPotDepth('sbc_bbr3_sbc')).toBe('SRP');
    expect(getPotDepth('sbc_bbr5_sbc')).toBe('SRP');
  });

  it('classifies 3bp (2 aggressions)', () => {
    expect(getPotDepth('utgr_bbr_utgc')).toBe('3bp');
    expect(getPotDepth('cor_bbr_coc')).toBe('3bp');
    expect(getPotDepth('sbc_bbr3_sbr14_bbc')).toBe('3bp');
  });

  it('classifies 4bp (3 aggressions)', () => {
    expect(getPotDepth('utgr_bbr_utgr22_bbc')).toBe('4bp');
    expect(getPotDepth('btnr_bbr_btnr27_bbc')).toBe('4bp');
    expect(getPotDepth('sbc_bbr3_sbr14_bbr27_sbc')).toBe('4bp');
  });

  it('classifies 5bp (4 aggressions)', () => {
    expect(getPotDepth('utgr_bbr_utgr_bbr34_utgc')).toBe('5bp');
    expect(getPotDepth('utgr_sbr_utgr_sbr40_utgc')).toBe('5bp');
  });
});

describe('getFlopOpener', () => {
  it('extracts opener from SRP', () => {
    expect(getFlopOpener('utgr_bbc')).toBe('UTG');
    expect(getFlopOpener('btnr_bbc')).toBe('BTN');
    expect(getFlopOpener('cor_btnc')).toBe('CO');
  });

  it('extracts opener from limp variant (SB)', () => {
    expect(getFlopOpener('sbc_bb')).toBe('SB');
    expect(getFlopOpener('sbc_bbr3_sbc')).toBe('SB');
  });

  it('extracts opener from 3bp/4bp/5bp (unchanged from SRP)', () => {
    expect(getFlopOpener('utgr_bbr_utgc')).toBe('UTG');
    expect(getFlopOpener('utgr_bbr_utgr22_bbc')).toBe('UTG');
    expect(getFlopOpener('utgr_bbr_utgr_bbr34_utgc')).toBe('UTG');
  });
});

describe('getFlopCaller', () => {
  it('extracts caller from SRP (= preflop caller)', () => {
    expect(getFlopCaller('utgr_bbc')).toBe('BB');
    expect(getFlopCaller('cor_btnc')).toBe('BTN');
    expect(getFlopCaller('btnr_sbc')).toBe('SB');
  });

  it('extracts caller from limp variant (= BB option)', () => {
    expect(getFlopCaller('sbc_bb')).toBe('BB');
  });

  it('extracts caller from 3bp (= original opener who calls the 3bet)', () => {
    expect(getFlopCaller('utgr_bbr_utgc')).toBe('UTG');
    expect(getFlopCaller('cor_btnr_coc')).toBe('CO');
  });

  it('extracts caller from 4bp/5bp', () => {
    expect(getFlopCaller('utgr_bbr_utgr22_bbc')).toBe('BB');
    expect(getFlopCaller('utgr_bbr_utgr_bbr34_utgc')).toBe('UTG');
  });
});

describe('getFlopVariantFromPreflopNode', () => {
  it('direct match: nodePath is already a variant (limp)', () => {
    expect(getFlopVariantFromPreflopNode('sbc_bb')).toBe('sbc_bb');
  });

  it('append "c": SRP termination', () => {
    expect(getFlopVariantFromPreflopNode('utgr_bb')).toBe('utgr_bbc');
    expect(getFlopVariantFromPreflopNode('cor_btn')).toBe('cor_btnc');
    expect(getFlopVariantFromPreflopNode('btnr_sb')).toBe('btnr_sbc');
  });

  it('append "c": 3bp termination', () => {
    expect(getFlopVariantFromPreflopNode('utgr_bbr_utg')).toBe('utgr_bbr_utgc');
    expect(getFlopVariantFromPreflopNode('cor_bbr_co')).toBe('cor_bbr_coc');
  });

  it('size insertion: 4bp single-size match', () => {
    // utgr_bbr_utgr_bb → utgr_bbr_utgr22_bbc (only one 4bet size in data)
    expect(getFlopVariantFromPreflopNode('utgr_bbr_utgr_bb')).toBe('utgr_bbr_utgr22_bbc');
    expect(getFlopVariantFromPreflopNode('btnr_bbr_btnr_bb')).toBe('btnr_bbr_btnr27_bbc');
  });

  it('size insertion: 5bp single-size match', () => {
    expect(getFlopVariantFromPreflopNode('utgr_bbr_utgr_bbr_utg')).toBe('utgr_bbr_utgr_bbr34_utgc');
  });

  it('ambiguous multi-size returns null (caller picks via UI)', () => {
    // sbc_bbr_sb has both sbc_bbr3_sbc and sbc_bbr5_sbc as candidate variants
    expect(getFlopVariantFromPreflopNode('sbc_bbr_sb')).toBeNull();
  });

  it('unknown preflop nodes return null', () => {
    expect(getFlopVariantFromPreflopNode('nonexistent')).toBeNull();
    expect(getFlopVariantFromPreflopNode('')).toBeNull();
  });

  it('preflop fold/allin terminals (no flop variant) return null', () => {
    // utgr_bbai_utg = UTG to act after BB all-in (no flop after this line)
    expect(getFlopVariantFromPreflopNode('utgr_bbai_utg')).toBeNull();
  });
});

describe('getFlopResponder', () => {
  it('extracts responder from SRP (= caller, segment 1)', () => {
    expect(getFlopResponder('utgr_bbc')).toBe('BB');
    expect(getFlopResponder('cor_btnc')).toBe('BTN');
    expect(getFlopResponder('btnr_sbc')).toBe('SB');
  });

  it('extracts responder from limp variants (segment 1)', () => {
    expect(getFlopResponder('sbc_bb')).toBe('BB');
    expect(getFlopResponder('sbc_bbr3_sbc')).toBe('BB');
  });

  it('extracts responder from 3bp/4bp/5bp (= segment 1, NOT the last actor)', () => {
    // utgr_bbr_utgc: 3bp, UTG closes (= caller), but RESPONDER is BB (the 3-bettor)
    expect(getFlopResponder('utgr_bbr_utgc')).toBe('BB');
    expect(getFlopResponder('utgr_bbr_utgr22_bbc')).toBe('BB');
    expect(getFlopResponder('utgr_bbr_utgr_bbr34_utgc')).toBe('BB');
    expect(getFlopResponder('cor_btnr_coc')).toBe('BTN');
  });

  it('throws on malformed variant (single segment)', () => {
    expect(() => getFlopResponder('utg')).toThrow();
  });
});

describe('findFlopVariants', () => {
  it('SRP standard (UTG vs BB)', () => {
    expect(findFlopVariants('UTG', 'BB', 'SRP')).toEqual(['utgr_bbc']);
  });

  it('SRP via cold-call (CO vs BTN)', () => {
    expect(findFlopVariants('CO', 'BTN', 'SRP')).toEqual(['cor_btnc']);
  });

  it('limp (SB vs BB, action=limp)', () => {
    expect(findFlopVariants('SB', 'BB', 'limp', 'limp')).toEqual(['sbc_bb']);
  });

  it('SB-limp + iso (action=limp, depth=SRP) returns BOTH iso sizes', () => {
    expect(findFlopVariants('SB', 'BB', 'SRP', 'limp')).toEqual([
      'sbc_bbr3_sbc',
      'sbc_bbr5_sbc',
    ]);
  });

  it('SB-open SRP', () => {
    expect(findFlopVariants('SB', 'BB', 'SRP', 'open')).toEqual(['sbr_bbc']);
  });

  it('3bp variants (UTG vs BB)', () => {
    expect(findFlopVariants('UTG', 'BB', '3bp')).toEqual(['utgr_bbr_utgc']);
  });

  it('4bp variants (UTG vs BB)', () => {
    expect(findFlopVariants('UTG', 'BB', '4bp')).toEqual(['utgr_bbr_utgr22_bbc']);
  });

  it('5bp variants (UTG vs BB)', () => {
    expect(findFlopVariants('UTG', 'BB', '5bp')).toEqual(['utgr_bbr_utgr_bbr34_utgc']);
  });

  it('non-existent combination returns empty array (HJ vs CO SRP)', () => {
    // HJ doesn't open + CO doesn't cold-call HJ in this data
    expect(findFlopVariants('HJ', 'CO', 'SRP')).toEqual([]);
  });

  it('5bp not available for HJ opener returns empty', () => {
    expect(findFlopVariants('HJ', 'BB', '5bp')).toEqual([]);
  });

  it('limp not available with open action', () => {
    expect(findFlopVariants('SB', 'BB', 'limp', 'open')).toEqual([]);
  });

  it('limp only valid for SB opener', () => {
    expect(findFlopVariants('UTG', 'BB', 'limp', 'limp')).toEqual([]);
  });

  it('returns sorted array', () => {
    const result = findFlopVariants('SB', 'BB', 'SRP', 'limp');
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });
});

describe('getDefaultFlopVariantFromPreflopNode', () => {
  it('falls through to strict version for direct match', () => {
    expect(getDefaultFlopVariantFromPreflopNode('sbc_bb')).toBe('sbc_bb');
  });

  it('falls through for suffix c match', () => {
    expect(getDefaultFlopVariantFromPreflopNode('utgr_bb')).toBe('utgr_bbc');
    expect(getDefaultFlopVariantFromPreflopNode('cor_btn')).toBe('cor_btnc');
  });

  it('falls through for unambiguous single-size insertion (4bp)', () => {
    expect(getDefaultFlopVariantFromPreflopNode('utgr_bbr_utgr_bb')).toBe(
      'utgr_bbr_utgr22_bbc',
    );
  });

  it('falls through for unambiguous 5bp', () => {
    expect(getDefaultFlopVariantFromPreflopNode('utgr_bbr_utgr_bbr_utg')).toBe(
      'utgr_bbr_utgr_bbr34_utgc',
    );
  });

  it('returns smallest sort-order match for ambiguous multi-size (limp iso)', () => {
    // sbc_bbr_sb → both sbc_bbr3_sbc and sbc_bbr5_sbc available
    // default picks the smallest sort-order = sbc_bbr3_sbc
    expect(getDefaultFlopVariantFromPreflopNode('sbc_bbr_sb')).toBe('sbc_bbr3_sbc');
  });

  it('returns null when no variant exists at all', () => {
    expect(getDefaultFlopVariantFromPreflopNode('nonexistent')).toBeNull();
    expect(getDefaultFlopVariantFromPreflopNode('')).toBeNull();
  });

  it('returns null for allin terminals (no flop reachable)', () => {
    expect(getDefaultFlopVariantFromPreflopNode('utgr_bbai_utg')).toBeNull();
    expect(getDefaultFlopVariantFromPreflopNode('utgr_bbai_bb')).toBeNull();
  });

  it('returns null for RFI single-segment nodes (flop not reachable from root)', () => {
    expect(getDefaultFlopVariantFromPreflopNode('utg')).toBeNull();
    expect(getDefaultFlopVariantFromPreflopNode('hj')).toBeNull();
  });

  it('returns null for (HJ, CO) SRP-style which has no flop variant', () => {
    // CO doesn't cold-call HJ in this dataset
    expect(getDefaultFlopVariantFromPreflopNode('hjr_co')).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// Phase R2: UI 連携 helper
// ----------------------------------------------------------------------------

describe('findFlopVariantFromUI', () => {
  it('UTG + BB + srp → utgr_bbc', () => {
    expect(findFlopVariantFromUI(['UTG', 'BB'], 'srp')).toBe('utgr_bbc');
  });

  it('順序逆 (BB + UTG + srp) も同じ結果', () => {
    expect(findFlopVariantFromUI(['BB', 'UTG'], 'srp')).toBe('utgr_bbc');
  });

  it('SB + BB + limp → sbc_bb', () => {
    expect(findFlopVariantFromUI(['SB', 'BB'], 'limp')).toBe('sbc_bb');
  });

  it('SB + BB + srp → sbr_bbc (open tree)', () => {
    expect(findFlopVariantFromUI(['SB', 'BB'], 'srp')).toBe('sbr_bbc');
  });

  it('UTG + BB + 3bp → utgr_bbr_utgc', () => {
    expect(findFlopVariantFromUI(['UTG', 'BB'], '3bp')).toBe('utgr_bbr_utgc');
  });

  it('UTG + BB + 4bp → utgr_bbr_utgr22_bbc', () => {
    expect(findFlopVariantFromUI(['UTG', 'BB'], '4bp')).toBe('utgr_bbr_utgr22_bbc');
  });

  it('UTG + BB + 5bp → utgr_bbr_utgr_bbr34_utgc', () => {
    expect(findFlopVariantFromUI(['UTG', 'BB'], '5bp')).toBe('utgr_bbr_utgr_bbr34_utgc');
  });

  it('UTG + SB + 5bp → utgr_sbr_utgr_sbr40_utgc', () => {
    expect(findFlopVariantFromUI(['UTG', 'SB'], '5bp')).toBe('utgr_sbr_utgr_sbr40_utgc');
  });

  it('HJ + BB + 5bp → null (5bp は UTG-X のみ)', () => {
    expect(findFlopVariantFromUI(['HJ', 'BB'], '5bp')).toBeNull();
  });

  it('UTG + HJ + srp → null (HJ は UTG を cold-call しない)', () => {
    expect(findFlopVariantFromUI(['UTG', 'HJ'], 'srp')).toBeNull();
  });

  it('UTG + HJ + 3bp → utgr_hjr_utgc (HJ 3-bet)', () => {
    expect(findFlopVariantFromUI(['UTG', 'HJ'], '3bp')).toBe('utgr_hjr_utgc');
  });

  it('limp は SB-BB 以外で null', () => {
    expect(findFlopVariantFromUI(['UTG', 'BB'], 'limp')).toBeNull();
    expect(findFlopVariantFromUI(['CO', 'BTN'], 'limp')).toBeNull();
  });
});

describe('reverseEngineerVariantToUI', () => {
  it('utgr_bbc → (UTG, BB) + srp', () => {
    expect(reverseEngineerVariantToUI('utgr_bbc')).toEqual({
      positions: ['UTG', 'BB'],
      bucket: 'srp',
    });
  });

  it('sbc_bb → (SB, BB) + limp', () => {
    expect(reverseEngineerVariantToUI('sbc_bb')).toEqual({
      positions: ['SB', 'BB'],
      bucket: 'limp',
    });
  });

  it('sbc_bbr3_sbc (limp-tree SRP) → null (新 UI 表現不可、2bp 廃止後)', () => {
    expect(reverseEngineerVariantToUI('sbc_bbr3_sbc')).toBeNull();
  });

  it('sbc_bbr3_sbr14_bbc (limp-tree 3bp) → null (同上)', () => {
    expect(reverseEngineerVariantToUI('sbc_bbr3_sbr14_bbc')).toBeNull();
  });

  it('sbc_bbr3_sbr14_bbr27_sbc (limp-tree 4bp) → null', () => {
    expect(reverseEngineerVariantToUI('sbc_bbr3_sbr14_bbr27_sbc')).toBeNull();
  });

  it('sbr_bbc → (SB, BB) + srp (open tree)', () => {
    expect(reverseEngineerVariantToUI('sbr_bbc')).toEqual({
      positions: ['SB', 'BB'],
      bucket: 'srp',
    });
  });

  it('utgr_bbr_utgc → (UTG, BB) + 3bp', () => {
    expect(reverseEngineerVariantToUI('utgr_bbr_utgc')).toEqual({
      positions: ['UTG', 'BB'],
      bucket: '3bp',
    });
  });

  it('utgr_bbr_utgr22_bbc → (UTG, BB) + 4bp', () => {
    expect(reverseEngineerVariantToUI('utgr_bbr_utgr22_bbc')).toEqual({
      positions: ['UTG', 'BB'],
      bucket: '4bp',
    });
  });

  it('utgr_bbr_utgr_bbr34_utgc → (UTG, BB) + 5bp', () => {
    expect(reverseEngineerVariantToUI('utgr_bbr_utgr_bbr34_utgc')).toEqual({
      positions: ['UTG', 'BB'],
      bucket: '5bp',
    });
  });

  it('未知 variant は null', () => {
    expect(reverseEngineerVariantToUI('nonexistent')).toBeNull();
  });

  it('findFlopVariantFromUI と reverseEngineerVariantToUI は逆関数 (sample)', () => {
    // limp-tree (sbc_*) higher depth は新 UI で表現不可 (reverseEngineer が null) のため除外
    const samples = ['utgr_bbc', 'sbc_bb', 'utgr_bbr_utgc', 'sbr_bbc', 'btnr_bbc'];
    for (const v of samples) {
      const ui = reverseEngineerVariantToUI(v);
      if (!ui) continue;
      const backToVariant = findFlopVariantFromUI(ui.positions, ui.bucket);
      expect(backToVariant).toBe(v);
    }
  });
});

// ----------------------------------------------------------------------------
// Fix 3: 全 (pair, bucket) mapping の確定 (UI 仕様の lock)
// ----------------------------------------------------------------------------

describe('UI mapping 完全列挙 (Fix 3 で確定)', () => {
  const POSITIONS: Position[] = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
  const BUCKETS: PreflopBucket[] = ['limp', 'srp', '3bp', '4bp', '5bp'];

  // 各 pair に対する期待 variant (null = disabled)。
  // pair の順序は (posA, posB) を渡した時の findFlopVariantFromUI の入力順序 (内部で sort)。
  // 全 15 pair × 5 bucket = 75 セルを明示的に固定。
  const EXPECTED: Record<string, Record<PreflopBucket, string | null>> = {
    'SB-BB':  { limp: 'sbc_bb', srp: 'sbr_bbc',  '3bp': 'sbr_bbr_sbc',          '4bp': 'sbr_bbr_sbr21_bbc',        '5bp': null },
    'SB-UTG': { limp: null,     srp: 'utgr_sbc', '3bp': 'utgr_sbr_utgc',        '4bp': 'utgr_sbr_utgr21_sbc',      '5bp': 'utgr_sbr_utgr_sbr40_utgc' },
    'SB-HJ':  { limp: null,     srp: 'hjr_sbc',  '3bp': null,                   '4bp': null,                       '5bp': null },
    'SB-CO':  { limp: null,     srp: 'cor_sbc',  '3bp': 'cor_sbr_coc',          '4bp': null,                       '5bp': null },
    'SB-BTN': { limp: null,     srp: 'btnr_sbc', '3bp': 'btnr_sbr_btnc',        '4bp': 'btnr_sbr_btnr26_sbc',      '5bp': null },
    'BB-UTG': { limp: null,     srp: 'utgr_bbc', '3bp': 'utgr_bbr_utgc',        '4bp': 'utgr_bbr_utgr22_bbc',      '5bp': 'utgr_bbr_utgr_bbr34_utgc' },
    'BB-HJ':  { limp: null,     srp: 'hjr_bbc',  '3bp': 'hjr_bbr_hjc',          '4bp': 'hjr_bbr_hjr24_bbc',        '5bp': null },
    'BB-CO':  { limp: null,     srp: 'cor_bbc',  '3bp': 'cor_bbr_coc',          '4bp': 'cor_bbr_cor27_bbc',        '5bp': null },
    'BB-BTN': { limp: null,     srp: 'btnr_bbc', '3bp': null,                   '4bp': 'btnr_bbr_btnr27_bbc',      '5bp': null },
    'UTG-HJ': { limp: null,     srp: null,       '3bp': 'utgr_hjr_utgc',        '4bp': 'utgr_hjr_utgr20_hjc',      '5bp': null },
    'UTG-CO': { limp: null,     srp: null,       '3bp': 'utgr_cor_utgc',        '4bp': 'utgr_cor_utgr20_coc',      '5bp': null },
    'UTG-BTN':{ limp: null,     srp: 'utgr_btnc','3bp': 'utgr_btnr_utgc',       '4bp': 'utgr_btnr_utgr20_btnc',    '5bp': null },
    'HJ-CO':  { limp: null,     srp: null,       '3bp': 'hjr_cor_hjc',          '4bp': 'hjr_cor_hjr20_coc',        '5bp': null },
    'HJ-BTN': { limp: null,     srp: 'hjr_btnc', '3bp': 'hjr_btnr_hjc',         '4bp': 'hjr_btnr_hjr20_btnc',      '5bp': null },
    'CO-BTN': { limp: null,     srp: 'cor_btnc', '3bp': 'cor_btnr_coc',         '4bp': null,                       '5bp': null },
  };

  for (let i = 0; i < POSITIONS.length; i++) {
    for (let j = i + 1; j < POSITIONS.length; j++) {
      const a = POSITIONS[i];
      const b = POSITIONS[j];
      const pairKey = `${a}-${b}`;
      const expectedPair = EXPECTED[pairKey];
      if (!expectedPair) continue;

      for (const bucket of BUCKETS) {
        it(`${pairKey} + ${bucket} → ${expectedPair[bucket] ?? 'null (disabled)'}`, () => {
          expect(findFlopVariantFromUI([a, b], bucket)).toBe(expectedPair[bucket]);
        });
      }
    }
  }

  it('UI から到達できる variant 数: 40 / 45 (5 件は limp-tree higher depth)', () => {
    const reached = new Set<string>();
    for (let i = 0; i < POSITIONS.length; i++) {
      for (let j = i + 1; j < POSITIONS.length; j++) {
        for (const bucket of BUCKETS) {
          const v = findFlopVariantFromUI([POSITIONS[i], POSITIONS[j]], bucket);
          if (v !== null) reached.add(v);
        }
      }
    }
    expect(reached.size).toBe(40);
    // 残り 5 件は limp-tree higher depth (Fix 2 で意図的に除外)
    const unreached = [...FLOP_VARIANTS].filter((v) => !reached.has(v)).sort();
    expect(unreached).toEqual([
      'sbc_bbr3_sbc',
      'sbc_bbr3_sbr14_bbc',
      'sbc_bbr3_sbr14_bbr27_sbc',
      'sbc_bbr5_sbc',
      'sbc_bbr5_sbr18_bbc',
    ]);
  });
});
