import type { Position } from '../types/strategy';
import { AVAILABLE_NODE_PATHS } from './availableNodes';
import { NODE_META, type NodeMeta } from './nodeMeta';

// ----------------------------------------------------------------------------
// NOTE: 現在の UI は "RFI vs Response" の 2レンジ並列表示のみをサポート。
// 将来 3bet/4bet レベルのデータが入ったら、ここに actions level の概念
// (例: 'rfi' | '3bet' | '4bet') を追加し、別途「アクションレベル」セレクタ
// を再設計するか、本UIの拡張 (例: 3bet → 4bet を並列表示) を検討する。
// SCENARIO_CATEGORIES 構造はその時のために残してある。
// ----------------------------------------------------------------------------

export type CategoryId = 'rfi' | 'vs_rfi';

export interface Scenario {
  id: string;
  label: string;
  path: string;
  hero: Position;
  villain: Position | null;
  category: CategoryId;
}

export interface CategoryDef {
  id: CategoryId;
  label: string;
  scenarios: ReadonlyArray<Scenario>;
}

// Action order, early to late (6max preflop)
export const POSITION_ORDER: ReadonlyArray<Position> = [
  'UTG',
  'HJ',
  'CO',
  'BTN',
  'SB',
  'BB',
];

// 6max でオープン可能なポジション (BB は last なので RFI しない)
export type OpenerPosition = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB';
export const OPENER_POSITIONS: ReadonlyArray<OpenerPosition> = [
  'UTG',
  'HJ',
  'CO',
  'BTN',
  'SB',
];

/**
 * Opener より後ろのポジションを responder 候補として返す。
 * 表示順は BB から early の順 (UI ドロップダウンで BB がデフォルトに来るように)。
 */
export function getValidResponders(opener: OpenerPosition): ReadonlyArray<Position> {
  const idx = POSITION_ORDER.indexOf(opener);
  return POSITION_ORDER.slice(idx + 1).slice().reverse();
}

// SCHEMA v1.1.0: 新ソルバー出力 (`public/data/preflop/<config>/<node_path>.json`)。
// node_path はファイル内の game_info.node_path と一致する。
const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

export function getRfiPath(opener: OpenerPosition): string {
  return `${PREFLOP_DATA_ROOT}/${opener.toLowerCase()}.json`;
}

export function getVsRfiPath(opener: OpenerPosition, responder: Position): string {
  return `${PREFLOP_DATA_ROOT}/${opener.toLowerCase()}r_${responder.toLowerCase()}.json`;
}

export function getRfiScenario(opener: OpenerPosition): Scenario {
  return {
    id: `rfi_${opener.toLowerCase()}`,
    label: opener,
    path: getRfiPath(opener),
    hero: opener,
    villain: null,
    category: 'rfi',
  };
}

export function getVsRfiScenario(opener: OpenerPosition, responder: Position): Scenario {
  return {
    id: `${responder.toLowerCase()}_vs_${opener.toLowerCase()}`,
    label: `${responder} vs ${opener}`,
    path: getVsRfiPath(opener, responder),
    hero: responder,
    villain: opener,
    category: 'vs_rfi',
  };
}

// ----------------------------------------------------------------------------
// node_path ベースのヘルパー (Raise遷移用)
// ----------------------------------------------------------------------------

/** node_path から JSON のフルパスを生成。 */
export function getNodePath(nodePath: string): string {
  return `${PREFLOP_DATA_ROOT}/${nodePath}.json`;
}

/**
 * 任意の node_path に対する Scenario を生成。
 * hero は node_path の末尾セグメントから導出する (常に hero ポジションが末尾に来る命名規則)。
 * villain は安定して導出できないため null。
 */
export function getNodeScenario(nodePath: string): Scenario {
  const segments = nodePath.split('_');
  const heroLower = segments[segments.length - 1];
  const hero = heroLower.toUpperCase() as Position;
  return {
    id: `node_${nodePath}`,
    label: nodePath,
    path: getNodePath(nodePath),
    hero,
    villain: null,
    category: segments.length === 1 ? 'rfi' : 'vs_rfi',
  };
}

/**
 * 「side が raise した結果、相手側が応答するノード」のパスを構築する。
 *
 * @param clickedPath - raise を押したペインの現在の node_path
 * @param opponentHero - 相手ペインの hero ポジション (新ノードでも応答するのは相手)
 * @returns 相手ペイン用の新 node_path (例: "utgr_bb" + UTG → "utgr_bbr_utg")
 */
export function computeRaisedNodePath(clickedPath: string, opponentHero: Position): string {
  return `${clickedPath}r_${opponentHero.toLowerCase()}`;
}

/**
 * 「side が all-in した結果、相手側が応答するノード」のパスを構築する。
 * Raise と対称形 (suffix が `r_` ではなく `ai_`)。
 *
 * @param clickedPath - all-in を押したペインの現在の node_path
 * @param opponentHero - 相手ペインの hero ポジション
 * @returns 相手ペイン用の新 node_path (例: "utgr_bb" + UTG → "utgr_bbai_utg")
 */
export function computeAllinNodePath(clickedPath: string, opponentHero: Position): string {
  return `${clickedPath}ai_${opponentHero.toLowerCase()}`;
}

/** 計算した node_path がデータ集合に存在するかどうか (Raise ボタン enable 判定用)。 */
export function isAvailableNodePath(nodePath: string): boolean {
  return AVAILABLE_NODE_PATHS.has(nodePath);
}

/** RFI ノードの初期 node_path (例: "UTG" → "utg")。 */
export function initialLeftNodePath(opener: OpenerPosition): string {
  return opener.toLowerCase();
}

/** vs RFI ノードの初期 node_path (例: opener=UTG, responder=BB → "utgr_bb")。 */
export function initialRightNodePath(opener: OpenerPosition, responder: Position): string {
  return `${opener.toLowerCase()}r_${responder.toLowerCase()}`;
}

// ----------------------------------------------------------------------------
// Breadcrumb ラベル生成 (action_history から識別)
// ----------------------------------------------------------------------------

export type ActionType =
  | 'open' | '3bet' | '4bet' | '5bet' | '6bet'
  | 'all-in' | 'call' | 'limp' | 'fold';

export interface ActionLabel {
  position: string;
  actionType: ActionType;
  /** Raise系のみ数値、Allin/Call/Limp は null。 */
  sizeBB: number | null;
}

/** NodeMeta から ActionLabel に分類。ルートノード (lastAction=null) は null を返す。 */
export function classifyAction(meta: NodeMeta): ActionLabel | null {
  if (!meta.lastAction) return null;
  const { position, actionRaw, sizeBB } = meta.lastAction;
  let actionType: ActionType;
  if (actionRaw.startsWith('Raise')) {
    if (meta.priorRaiseCount === 0)      actionType = 'open';
    else if (meta.priorRaiseCount === 1) actionType = '3bet';
    else if (meta.priorRaiseCount === 2) actionType = '4bet';
    else if (meta.priorRaiseCount === 3) actionType = '5bet';
    else                                  actionType = '6bet';
  } else if (actionRaw.startsWith('Allin')) {
    actionType = 'all-in';
  } else if (actionRaw === 'Call') {
    actionType = meta.priorRaiseCount === 0 ? 'limp' : 'call';
  } else {
    actionType = 'fold';
  }
  // open/3bet/4bet/5bet/6bet ではサイズ表示、それ以外はサイズ非表示
  const showSize =
    actionType === 'open' || actionType === '3bet' || actionType === '4bet' ||
    actionType === '5bet' || actionType === '6bet';
  return { position, actionType, sizeBB: showSize ? sizeBB : null };
}

/** ActionLabel を表示文字列に整形。 例: "UTG open (2.5bb)", "BB 3bet (12bb)", "UTG all-in", "SB limp" */
export function formatActionLabel(label: ActionLabel): string {
  const { position, actionType, sizeBB } = label;
  if (actionType === 'all-in')        return `${position} all-in`;
  if (actionType === 'call')          return `${position} call`;
  if (actionType === 'limp')          return `${position} limp`;
  if (actionType === 'fold')          return `${position} fold`;
  // open / 3bet / 4bet / 5bet / 6bet
  const sizeStr = sizeBB !== null ? ` (${sizeBB}bb)` : '';
  return `${position} ${actionType}${sizeStr}`;
}

/** node_path から表示用ラベルを生成。ルートノードや未知パスでは null。 */
export function labelForNodePath(nodePath: string): string | null {
  const meta = NODE_META[nodePath];
  if (!meta) return null;
  const label = classifyAction(meta);
  return label ? formatActionLabel(label) : null;
}

// ----------------------------------------------------------------------------
// Legacy "all scenarios in flat lists" — kept for future re-introduction of
// category-based selection. Not used by the current dual-range UI.
// ----------------------------------------------------------------------------

const VS_RFI_MATRIX: ReadonlyArray<readonly [Position, ReadonlyArray<Position>]> = [
  ['BB', ['UTG', 'HJ', 'CO', 'BTN', 'SB']],
  ['SB', ['UTG', 'HJ', 'CO', 'BTN']],
  ['BTN', ['UTG', 'HJ', 'CO']],
  ['CO', ['UTG', 'HJ']],
  ['HJ', ['UTG']],
];

const RFI_SCENARIOS: ReadonlyArray<Scenario> = OPENER_POSITIONS.map((p) => getRfiScenario(p));

const VS_RFI_SCENARIOS: ReadonlyArray<Scenario> = VS_RFI_MATRIX.flatMap(([hero, villains]) =>
  villains.map((villain) =>
    // hero は Position だが OpenerPosition でない可能性 (BB) があるため、
    // 直接組み立てる。getVsRfiScenario は hero=responder, villain=opener
    ({
      id: `${hero.toLowerCase()}_vs_${villain.toLowerCase()}`,
      label: `${hero} vs ${villain}`,
      path: `${PREFLOP_DATA_ROOT}/${villain.toLowerCase()}r_${hero.toLowerCase()}.json`,
      hero,
      villain,
      category: 'vs_rfi' as const,
    }),
  ),
);

export const SCENARIO_CATEGORIES: ReadonlyArray<CategoryDef> = [
  { id: 'rfi', label: 'RFI', scenarios: RFI_SCENARIOS },
  { id: 'vs_rfi', label: 'vs RFI', scenarios: VS_RFI_SCENARIOS },
];

export const DEFAULT_SCENARIO: Scenario = SCENARIO_CATEGORIES[0].scenarios[0];

export function findCategory(category: CategoryId): CategoryDef {
  const c = SCENARIO_CATEGORIES.find((x) => x.id === category);
  if (!c) throw new Error(`Unknown category: ${category}`);
  return c;
}
