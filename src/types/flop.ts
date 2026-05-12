// Faithful TypeScript types for the flop tree JSON (GTOWizard-derived).
//
// 1ファイル = 1 ノード = 「ある actor が次に何をするか」の決定点。
// `action_totals` がレンジ平均、`solutions[]` が全 1,755 フロップボード別の解。
//
// 仕様の出典:
//  - docs/FLOP_STRATEGY_TAB.md §2.5 (構造解説)
//  - webscraping/gtowizard/REPORT_FOR_APP_MIGRATION.md (元データレポート)
//
// 観測サンプル: 2026-05-12 時点、120 ファイル抽出で enum 値・null パターン確定。

import type { Position } from './strategy';

// ----------------------------------------------------------------------------
// Enum unions (観測値ベース)
// ----------------------------------------------------------------------------

/** `_meta.next_actor` と action_chain で使う小文字 3 文字ポジション。 */
export type FlopActor = Lowercase<Position>; // 'utg' | 'hj' | 'mp' | 'co' | 'btn' | 'sb' | 'bb'

/**
 * アクション識別子。動的に R<size> が増えるため string で受ける。
 * 観測値: "F" (fold), "C" (call), "X" (check), "RAI" (all-in raise),
 *          "R6.35" / "R10.9" 等 (raise with size).
 */
export type ActionCode = string;

export type ActionType = 'FOLD' | 'CALL' | 'CHECK' | 'RAISE';

/** `simple_group` は ActionType と同じ集合 (観測上)。 */
export type SimpleGroup = ActionType;

/** GTOWizard が割り当てるサイジングカテゴリ。 */
export type AdvancedGroup =
  | 'FOLD'
  | 'CALL'
  | 'CHECK'
  | 'BET_SMALL'
  | 'BET_MEDIUM'
  | 'BET_LARGE'
  | 'BET_OVERBET';

export type StreetType = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';

export type RelativePosition = 'IP' | 'OOP';

// ----------------------------------------------------------------------------
// レンジ平均集計
// ----------------------------------------------------------------------------

export interface ActionTotal {
  action_code: ActionCode;
  /** 0.0 - 1.0 */
  frequency: number;
  /** 通常 1755 (全フロップ集計)。 */
  solved_action_count: number;
}

export interface PlayerTotal {
  position: Position;
  /** 未解決ボードがあると null になる場合あり。 */
  ev: number | null;
  eq: number | null;
  eqr: number | null;
}

// ----------------------------------------------------------------------------
// ボード別解 (solutions[])
// ----------------------------------------------------------------------------

export interface ActionSolution {
  action_code: ActionCode;
  /** 0.0 - 1.0 */
  frequency: number;
}

export interface PlayerSolution {
  position: Position;
  ev: number | null;
  eq: number | null;
  eqr: number | null;
}

export interface BoardSolution {
  /** 3 枚フロップ文字列 (例: "2h2d2c", "AsKsQs")。 */
  name: string;
  /** 現データセットでは常に null (重み付け用予約フィールド)。 */
  ratio: number | null;
  action_solutions: ActionSolution[];
  player_solutions: PlayerSolution[];
}

// ----------------------------------------------------------------------------
// players header (folded seats は含まない、現アクティブ 2 名のみ)
// ----------------------------------------------------------------------------

export interface FlopPlayer {
  position: Position;
  is_hero: boolean;
  relative_position: RelativePosition;
  /** 現データセットでは常に null。 */
  profile: null;
}

// ----------------------------------------------------------------------------
// _meta (アプリ側で付与した独自メタデータ)
// ----------------------------------------------------------------------------

export interface FlopMeta {
  /** Variant ディレクトリ名 (例: "utgr_bbc")。 */
  variant: string;
  /**
   * フロップ以降のアクションチェーン (人間可読、preflop 部分は含まない)。
   * 例: "X-R1.8-R6.35"。root ノードは "" (空文字)。
   */
  flop_chain: string;
  /**
   * 各ステップ = "<actor>_<action>" の小文字表現 (例: ["bb_x", "btn_b1_8"])。
   * 長さは `depth` と一致する。
   */
  action_chain: string[];
  /** フロップで行われたアクション数 (root=0、最大観測 5)。 */
  depth: number;
  /** このノードで次に動く actor の小文字ポジション。 */
  next_actor: FlopActor;
  /** 将来のターミナル分類用予約、現データセットでは常に null。 */
  terminal_type: string | null;
  /** スクレイプ時刻 (ISO-8601)。 */
  scraped_at: string;
}

// ----------------------------------------------------------------------------
// game_point (GTOWizard の render hint 情報)
// ----------------------------------------------------------------------------

export interface FlopSeatState {
  /** 'IP' | 'OOP' または null (e.g. preflop fold seats)。 */
  relative_postflop_position: RelativePosition | null;
  /** 現データセットでは常に null (手札は非公開)。 */
  hand: string | null;
  is_dealer: boolean;
  is_folded: boolean;
  is_hero: boolean;
  is_active: boolean;
  /** 数値文字列 (例: "100")。アプリ側で parseFloat する。 */
  stack: string;
  current_stack: string;
  chips_on_table: string;
  bounty: string | null;
  profile: null;
  position: Position;
  bounty_in_bb: number | null;
}

export interface FlopCurrentStreet {
  /** 本データセットでは "FLOP" 固定。 */
  type: StreetType;
  start_pot: string;
  end_pot: string;
}

export interface FlopGameState {
  /** 全 6 席分 (6max、folded seats も含む)。 */
  players: FlopSeatState[];
  current_street: FlopCurrentStreet;
  pot: string;
  pot_odds: string;
  /** 現在 act するポジション (`_meta.next_actor` 大文字化と一致)。 */
  active_position: Position;
  /** 3 枚フロップ (例: "QsTs7h")。 */
  board: string;
  /** 直前アクションの表示名 (例: "RAISE" | "CHECK")。 */
  bet_display_name: string;
}

export interface FlopAction {
  code: ActionCode;
  position: Position;
  type: ActionType;
  /** 数値文字列 (例: "0" fold, "1.8" call, "6.35" raise, "97.5" allin)。 */
  betsize: string;
  allin: boolean;
  is_hand_end: boolean;
  is_showdown: boolean;
  next_street: boolean;
  display_name: string;
  simple_group: SimpleGroup;
  advanced_group: AdvancedGroup;
  /** ベットサイズの pot 比 (例: "0.5", "1") または null (fold/call/check)。 */
  betsize_by_pot: string | null;
  /** このアクション後に動く position、ターミナルなら null。 */
  next_position: Position | null;
}

export interface FlopAvailableAction {
  action: FlopAction;
  /** 現データセットでは常に null (頻度は action_totals / action_solutions 側)。 */
  frequency: number | null;
  /** fold / 一部の allin で true。 */
  is_solution_end: boolean;
  /** GTOWizard 内部用、アプリ側では未使用。 */
  can_be_solved_by_ai: boolean;
  next_position: Position | null;
  selected: boolean;
}

export interface FlopGamePoint {
  game: FlopGameState;
  available_actions: FlopAvailableAction[];
  /** 現データセットでは常に null。 */
  custom_solution_id: null;
  is_node_locked: boolean;
  is_edited: boolean;
  is_editable: boolean;
  forced_fold: boolean;
  /** 現データセットでは常に null。 */
  available_node_edits: null;
  /** 現データセットでは常に空配列 []。 */
  merged_actions: unknown[];
  /** デフォルトで選択表示されるアクション (例: "F")。 */
  preset_action_code: string;
}

// ----------------------------------------------------------------------------
// ルートノード型 (= 1 JSON ファイル全体)
// ----------------------------------------------------------------------------

export interface FlopNode {
  _meta: FlopMeta;
  /** 観測上は常に "done"。 */
  status: string;
  /** 現データセットでは常に null (GTOWizard カスタム木機能は未使用)。 */
  custom_tree_id: null;
  /** 通常 length 1755 (全フロップボード)。 */
  solutions: BoardSolution[];
  /** ヘッドアップ後の active 2 名のみ (folded seats は含まない)。 */
  players: FlopPlayer[];
  action_totals: ActionTotal[];
  /**
   * filtered_ratio = 1.0 の現データセットでは action_totals と完全一致。
   * 将来サブレンジ filter を導入する場合に分離値が入る予定の枠。
   */
  filtered_action_totals: ActionTotal[];
  player_totals: PlayerTotal[];
  filtered_player_totals: PlayerTotal[];
  /** Filter 後に残るレンジの割合 (0.0 - 1.0)、現データセットでは常に 1.0。 */
  filtered_ratio: number;
  game_point: FlopGamePoint;
  /** 現データセットでは常に null。 */
  solved_board_count: number | null;
  /** 現データセットでは常に null。 */
  total_board_count: number | null;
}
