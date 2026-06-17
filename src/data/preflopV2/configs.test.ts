import { describe, it, expect } from 'vitest';
import {
  PREFLOP_V2_CONFIGS,
  DEFAULT_CONFIG_ID,
  findConfig,
  isGtoConfig,
  openOptions,
  rakeOptions,
  stackOptions,
  resolveConfig,
} from './configs';

describe('PREFLOP_V2_CONFIGS', () => {
  it('has 7 gto + 1 legacy 2.5x = 8 configs', () => {
    expect(PREFLOP_V2_CONFIGS).toHaveLength(8);
    expect(PREFLOP_V2_CONFIGS.filter((c) => c.source === 'gto')).toHaveLength(7);
    expect(PREFLOP_V2_CONFIGS.filter((c) => c.source === 'legacy')).toHaveLength(1);
  });
  it('default is 100bb NL500 GTO and is a gto config', () => {
    expect(DEFAULT_CONFIG_ID).toBe('cash_100bb_6max_nl500_gto');
    expect(isGtoConfig(DEFAULT_CONFIG_ID)).toBe(true);
  });
  it('the 2.5x config is legacy (not gto)', () => {
    expect(isGtoConfig('cash_100bb_6max_nl500_2_5x')).toBe(false);
    expect(findConfig('cash_100bb_6max_nl500_2_5x')?.source).toBe('legacy');
  });
});

describe('cascading (Open -> Rake -> Stack)', () => {
  it('Open options list GTO first', () => {
    expect(openOptions()).toEqual(['GTO', '2.5x']);
  });
  it('GTO supports both rakes; 2.5x only NL500', () => {
    expect(rakeOptions('GTO').sort()).toEqual(['NL50', 'NL500']);
    expect(rakeOptions('2.5x')).toEqual(['NL500']);
  });
  it('GTO+NL500 has all 6 stacks; GTO+NL50 only 100; 2.5x+NL500 only 100', () => {
    expect(stackOptions('GTO', 'NL500')).toEqual([20, 50, 75, 100, 150, 200]);
    expect(stackOptions('GTO', 'NL50')).toEqual([100]);
    expect(stackOptions('2.5x', 'NL500')).toEqual([100]);
  });
  it('resolveConfig maps valid triples and rejects invalid', () => {
    expect(resolveConfig('GTO', 'NL500', 200)?.id).toBe('cash_200bb_6max_nl500_gto');
    expect(resolveConfig('GTO', 'NL50', 100)?.id).toBe('cash_100bb_6max_nl50_gto');
    expect(resolveConfig('2.5x', 'NL500', 100)?.id).toBe('cash_100bb_6max_nl500_2_5x');
    // invalid: 2.5x only exists at 100bb / no 20bb NL50
    expect(resolveConfig('2.5x', 'NL500', 50)).toBeNull();
    expect(resolveConfig('GTO', 'NL50', 50)).toBeNull();
  });
});
