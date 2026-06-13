// buildRanking: is_vip フラグの算出と、tester / 残り日数を露出しないことの検証。

import { describe, it, expect } from 'vitest';
import { buildRanking } from './ranking';

interface Row {
  account_id: number;
  poker_name: string;
  total_points: number;
  achievement_ids: string | null;
  vip_until: number | null;
}

function row(over: Partial<Row>): Row {
  return { account_id: 1, poker_name: 'u', total_points: 10, achievement_ids: null, vip_until: null, ...over };
}

describe('buildRanking is_vip', () => {
  it('VIP 有効 (vip_until 未来) → is_vip: true', () => {
    const { entries } = buildRanking([row({ account_id: 1, vip_until: Date.now() + 1_000_000 })], 1);
    expect(entries[0].is_vip).toBe(true);
  });

  it('VIP 期限切れ (vip_until 過去) → is_vip: false', () => {
    const { entries } = buildRanking([row({ account_id: 1, vip_until: Date.now() - 1_000_000 })], 1);
    expect(entries[0].is_vip).toBe(false);
  });

  it('VIP 未付与 (vip_until null) → is_vip: false', () => {
    const { entries } = buildRanking([row({ account_id: 1, vip_until: null })], 1);
    expect(entries[0].is_vip).toBe(false);
  });

  it('エントリは tester / 残り日数 / vip_until を露出しない', () => {
    const { entries } = buildRanking([row({ account_id: 1, vip_until: Date.now() + 1_000_000 })], 1);
    const keys = Object.keys(entries[0]).sort();
    expect(keys).toEqual(
      ['achievement_ids', 'is_vip', 'points_visible', 'poker_name', 'rank', 'total_points'].sort(),
    );
    expect(keys).not.toContain('tester');
    expect(keys).not.toContain('vip_until');
    expect(keys).not.toContain('days');
  });
});
