// ランク判定: 実績 ID 配列 → 現在のランク (= 最高 tier の全実績達成)。
//
// ルール:
//   - 全実績未達成 → tier=null (「ランクなし」、 灰色、 イラストなし)
//   - 下位 tier の全実績達成 → そのランク
//   - 加えて次の tier の全実績も達成 → さらに上のランクに昇格
//   - 一つでも未達なら上位ランクには昇格しない
//   - tier.implemented=false (プロ / マスター) は判定スキップ
//
// 実績が増えて未達成扱いになれば自動的に下位ランクに戻る (毎回再計算なので)。

import { ACHIEVEMENTS, TIERS, type Tier, type TierId } from '../data/achievements';

export interface Rank {
  /** 達成中の最高 tier id。 一つも未達成なら null (= ランクなし)。 */
  tier: TierId | null;
  /** 表示用ラベル ('ランクなし' / 'ビギナー' / 'スタンダード' / ...) */
  label: string;
  /** ティアアイコン URL (ランクなしは null)。 */
  image: string | null;
  /** ティア色 (テキスト色)。 */
  color: string;
  /** ティアの背景色 (ヒーローカード用)。 */
  bg: string | null;
  /** ティアの枠線色。 */
  border: string | null;
}

const RANK_NONE: Rank = {
  tier: null,
  label: 'ランクなし',
  image: null,
  color: '#888780',
  bg: null,
  border: null,
};

function rankOfTier(t: Tier): Rank {
  return {
    tier: t.id,
    label: t.label,
    image: t.image,
    color: t.textColor,
    bg: t.bg,
    border: t.border,
  };
}

export function calculateRank(unlockedIds: ReadonlyArray<string>): Rank {
  const unlocked = new Set(unlockedIds);
  let highest: Tier | null = null;
  // TIERS は表示順 = ランク低 → 高。 implemented=true のみ評価。
  for (const tier of TIERS) {
    if (!tier.implemented) break;
    const required = ACHIEVEMENTS.filter((a) => a.tier === tier.id).map((a) => a.id);
    if (required.length === 0) break;
    // rankThreshold 指定時はその個数以上で到達 (部分達成許容)。未指定は全達成必須。
    const need = tier.rankThreshold ?? required.length;
    const got = required.filter((id) => unlocked.has(id)).length;
    if (got < need) break;
    highest = tier;
  }
  return highest ? rankOfTier(highest) : RANK_NONE;
}
