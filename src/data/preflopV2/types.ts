// Phase 2a: 新 preflop range (R2 配信) の型。既存 strategy タブ (types/strategy.ts,
// utils/normalize.ts) には依存しない、別系統の型。

/** R2 から取得する 1 ノードの JSON (scripts/build-preflop-data.cjs の出力形)。 */
export interface PreflopV2Node {
  _meta: {
    preflop_actions: string; // canonical chain, dash 区切り ("" = root)。例 "F-F-R2.5"
    actor: string; // 小文字ポジション ("utg" / "sb" ...)
    active_positions?: string[]; // 一部 config (nl50) には無い
    stack_depth_bb?: number;
    gametype?: string;
    [k: string]: unknown;
  };
  game_info: {
    pot?: string;
    pot_odds?: string;
    active_position?: string;
    bet_display_name?: string;
    players?: PreflopV2Player[];
    [k: string]: unknown;
  };
  actions_legend: Record<string, string>; // 例 { F:"fold (0bb)", "R13.1":"raise (13.1bb)" }
  hands: Record<string, PreflopV2Hand>;
}

export interface PreflopV2Player {
  position: string;
  is_hero?: boolean;
  is_active?: boolean;
  is_folded?: boolean;
}

export interface PreflopV2Hand {
  allin: number; // 0-100
  raise: number;
  call: number;
  fold: number;
  range_weight: number | null;
  evs?: Record<string, number | null>;
}

/** R2 から取得する config 単位のナビ index (scripts/build-preflop-data.cjs の出力形)。 */
export interface PreflopV2Index {
  config: string;
  label: string;
  stackBb: number | null;
  rake: string | null;
  openSize: string | null;
  positionOrder: string[];
  /** ポジション -> 開始ノード stem (例 "UTG":"root", "BTN":"F_F_F")。 */
  entries: Record<string, string>;
  /**
   * ノード stem -> { アクショントークン(canonical 例 "R6.5"/"C"/"F"/"RAI") : 遷移先ノード stem }。
   * 遷移先は single-villain で欠けた中間 fold を skip-connect 済み。
   */
  nodes: Record<string, Record<string, string>>;
}
