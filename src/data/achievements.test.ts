import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, TIERS, achievementsByTier, tierById } from './achievements';

describe('ACHIEVEMENTS マスタ (再設計後)', () => {
  it('ビギナー 3 + スタンダード 11 + プロ 7 = 21 個', () => {
    expect(achievementsByTier('shrimp')).toHaveLength(3);
    expect(achievementsByTier('fish')).toHaveLength(11);
    expect(achievementsByTier('shark')).toHaveLength(7);
    expect(achievementsByTier('whale')).toHaveLength(0);
    expect(ACHIEVEMENTS).toHaveLength(21);
  });

  it('旧 fish_1 / fish_2 は廃止されている', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(ids).not.toContain('fish_1');
    expect(ids).not.toContain('fish_2');
  });

  it('ビギナー 3 個は無変更 (キー固定)', () => {
    expect(achievementsByTier('shrimp').map((a) => a.id)).toEqual(['shrimp_1', 'shrimp_2', 'shrimp_3']);
  });

  it('スタンダード = fish、 rankThreshold 8 (部分達成許容)', () => {
    expect(tierById('fish')?.rankThreshold).toBe(8);
  });

  it('プロ (shark) は implemented=false (ランクUI非表示、 判定記録のみ)', () => {
    expect(tierById('shark')?.implemented).toBe(false);
  });

  it('実績キーは一意', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全 tier 値が TIERS に存在する', () => {
    const tierIds = new Set(TIERS.map((t) => t.id));
    for (const a of ACHIEVEMENTS) expect(tierIds.has(a.tier)).toBe(true);
  });

  it('fish / shark は全て trainingType と maxBest を持つ (進捗% 表示用)', () => {
    for (const a of ACHIEVEMENTS.filter((x) => x.tier === 'fish' || x.tier === 'shark')) {
      expect(a.trainingType, a.id).toBeTruthy();
      expect((a.maxBest ?? 0) > 0, a.id).toBe(true);
    }
  });

  it('⚠️ オープンの maxBest は 20 (pt 表示の 10 ではない)', () => {
    const open = ACHIEVEMENTS.find((a) => a.id === 'fish_pf_open');
    expect(open?.trainingType).toBe('preflop_beginner_open');
    expect(open?.maxBest).toBe(20);
  });

  it('名前は「カテゴリ 階級 …」形式 (どのトレーニングか明示)', () => {
    expect(ACHIEVEMENTS.find((a) => a.id === 'fish_flop_cb_srp')?.name).toBe('ポストフロップ 中級 レンジCB SRP 80%');
    expect(ACHIEVEMENTS.find((a) => a.id === 'shark_pf_intermediate')?.name).toBe('プリフロップ 中級 総合 100%');
  });
});
