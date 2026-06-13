// 「間違えた問題」の階級 (tier) 定義。
//   一覧 (MissedProblemsSection) と再出題を「階級」単位に統合するためのプール定義。
//   サーバ側 (functions/api/account/missed-problems.ts) の TIER_TO_TRAINING_TYPES と対応。

import type { MissedTierKey, MissedTrainingType } from '../../api/missedProblems';

export interface MissedTierDef {
  key: MissedTierKey;
  category: 'preflop' | 'flop';
  /** 表示ラベル (初級 / 中級)。 */
  label: string;
  /** この階級に属する training_type 群 (件数合算・プール対象)。 */
  trainingTypes: MissedTrainingType[];
}

export const MISSED_TIERS: ReadonlyArray<MissedTierDef> = [
  {
    key: 'tier_pf_beginner',
    category: 'preflop',
    label: '初級',
    trainingTypes: [
      'preflop_beginner',
      'preflop_beginner_open',
      'preflop_beginner_vs_open',
      'preflop_beginner_vs_3bet_4bet',
    ],
  },
  {
    key: 'tier_pf_intermediate',
    category: 'preflop',
    label: '中級',
    trainingTypes: [
      'preflop_intermediate',
      'preflop_intermediate_ep',
      'preflop_intermediate_lp',
      'preflop_intermediate_blind',
    ],
  },
  { key: 'tier_flop_beginner', category: 'flop', label: '初級', trainingTypes: ['flop_beginner'] },
  {
    key: 'tier_flop_intermediate',
    category: 'flop',
    label: '中級',
    trainingTypes: ['flop_cb_srp', 'flop_cb_3bp', 'flop_donk_bmcb'],
  },
];

export function missedTierByKey(key: string): MissedTierDef | undefined {
  return MISSED_TIERS.find((t) => t.key === key);
}
