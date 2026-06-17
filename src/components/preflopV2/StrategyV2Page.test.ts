import { describe, it, expect } from 'vitest';
import { segmentsAfterBase } from './route';

describe('segmentsAfterBase', () => {
  it('returns [] for the base route (config picker)', () => {
    expect(segmentsAfterBase('/strategy-v2')).toEqual([]);
    expect(segmentsAfterBase('/strategy-v2/')).toEqual([]);
  });
  it('returns [config] for the position picker route', () => {
    expect(segmentsAfterBase('/strategy-v2/cash_100bb_6max_nl500_gto')).toEqual([
      'cash_100bb_6max_nl500_gto',
    ]);
  });
  it('returns [config, stem] for the range view route', () => {
    expect(segmentsAfterBase('/strategy-v2/cash_100bb_6max_nl500_gto/F_F_F')).toEqual([
      'cash_100bb_6max_nl500_gto',
      'F_F_F',
    ]);
  });
  it('decodes URL-encoded segments', () => {
    expect(segmentsAfterBase('/strategy-v2/c/F_F_F%20')).toEqual(['c', 'F_F_F ']);
  });
});
