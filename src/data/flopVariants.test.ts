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
} from './flopVariants';

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
