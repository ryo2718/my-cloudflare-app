// EV ティア別ハンドリスト lookup (純粋関数, テスト容易)。
//
// 出題ロジック (preflopBeginner.ts) から、ポジションごとの対象ティア集合に対して
// ランダムにハンドを抽選するときの基盤。
//
// 仕様:
//   - 169 ハンドはすべて evRanking.ts の EV_RANKING に存在 (build-ev-tiers.cjs 生成)
//   - tier 毎の hand 一覧は EV_RANKING を一度だけ集計してキャッシュ
//   - pickRandom* は Math.random() を直接使う (RNG 注入は呼び出し側で `Math.random` を
//     stub する形で対応)

import { EV_RANKING, type EvTier } from '../evRanking';
import type { Hand } from '../../types/strategy';

const HANDS_BY_TIER: Readonly<Record<EvTier, ReadonlyArray<Hand>>> = (() => {
  const map = new Map<EvTier, Hand[]>();
  for (const [handStr, info] of Object.entries(EV_RANKING)) {
    const tier = info.tier;
    if (!map.has(tier)) map.set(tier, []);
    map.get(tier)!.push(handStr as Hand);
  }
  // すべての tier に空でなく entry 化
  const out = {} as Record<EvTier, ReadonlyArray<Hand>>;
  for (const tier of [
    'premium', 'elite', 'strong', 'good', 'standard',
    'average', 'weak', 'marginal', 'poor', 'garbage', 'trash',
  ] as EvTier[]) {
    out[tier] = map.get(tier) ?? [];
  }
  return out;
})();

/** 指定 tier に属する全ハンド (順序は EV_RANKING 走査順)。 */
export function getHandsByTier(tier: EvTier): ReadonlyArray<Hand> {
  return HANDS_BY_TIER[tier];
}

/** 指定ハンドが属する tier。未登録なら null。 */
export function getTierOfHand(hand: Hand): EvTier | null {
  const info = EV_RANKING[hand];
  return info ? info.tier : null;
}

/** 単一 tier からランダムに 1 ハンド抽選。空 tier は例外。 */
export function pickRandomHandFromTier(tier: EvTier): Hand {
  const arr = HANDS_BY_TIER[tier];
  if (arr.length === 0) throw new Error(`tier '${tier}' has no hands`);
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 複数 tier の union からランダムに 1 ハンド抽選。 */
export function pickRandomHandFromTiers(tiers: ReadonlyArray<EvTier>): Hand {
  const pool: Hand[] = [];
  for (const t of tiers) pool.push(...HANDS_BY_TIER[t]);
  if (pool.length === 0) throw new Error(`tiers ${tiers.join(',')} have no hands`);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** tier 群の union を一覧で返す (テスト・検算用)。 */
export function getHandsFromTiers(tiers: ReadonlyArray<EvTier>): Hand[] {
  const pool: Hand[] = [];
  for (const t of tiers) pool.push(...HANDS_BY_TIER[t]);
  return pool;
}
