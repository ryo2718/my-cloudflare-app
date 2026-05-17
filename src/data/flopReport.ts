// Flop レポート (donk + CB strategy analysis) のドメインヘルパー。
//
// Phase 1: 純粋関数 + 単一セル用 fetch wrapper。UI/components は別 Phase。
//
// 用語:
//   aggressor = preflop で最後に raise した player
//   caller    = preflop で action を閉じた player (= getFlopCaller)
//   OOP/IP    = postflop seating order (SB < BB < UTG < HJ < MP < CO < BTN)
//   CB        = preflop aggressor が flop で最初に取る aggressive (R* / RAI)
//   donk      = preflop caller が OOP の時に flop で最初に取る aggressive
//               (caller が IP のマッチアップでは定義されない)
//
// Node 位置:
//   aggressor=OOP (caller=IP): CB at root, donk N/A
//   aggressor=IP  (caller=OOP): donk at root, CB at flop_<oop>_x.json (after OOP checks)

import type { ActionSolution, ActionTotal, FlopNode } from '../types/flop';
import type { Position } from '../types/strategy';
import { fetchFlopNode } from '../hooks/useFlopNode';
import {
  findFlopVariantFromUI,
  getFlopCaller,
  getFlopOpener,
  getFlopResponder,
  type PreflopBucket,
} from './flopVariants';

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

/** Phase 1 では limp を扱わない (Flop レポートは open-tree 4 depth が対象)。 */
export type FlopReportDepth = Exclude<PreflopBucket, 'limp'>;

export const FLOP_REPORT_DEPTHS: ReadonlyArray<FlopReportDepth> = [
  'srp',
  '3bp',
  '4bp',
  '5bp',
];

/** 6max で扱うポジション (MP は既存データに含まれず非対象)。 */
export const REPORT_POSITIONS: ReadonlyArray<Position> = [
  'UTG',
  'HJ',
  'CO',
  'BTN',
  'SB',
  'BB',
];

/**
 * Postflop seating order (act-first = OOP)。SB が最 OOP、BTN が最 IP。
 * MP も将来用に保持 (現データセットには出てこない)。
 */
const POSTFLOP_ORDER: ReadonlyArray<Position> = [
  'SB',
  'BB',
  'UTG',
  'HJ',
  'MP',
  'CO',
  'BTN',
];

export interface MatchupCell {
  /** Postflop OOP (acts first) の位置。 */
  oop: Position;
  /** Postflop IP の位置。 */
  ip: Position;
  /** Pot depth (preflop シナリオ)。 */
  depth: FlopReportDepth;
  /** Variant ディレクトリ名 (e.g. "utgr_bbc")。データなしなら null。 */
  variant: string | null;
  /** Preflop で最後に raise した position (= flop CB を行う側)。 */
  aggressor: Position | null;
  /** Preflop で action を閉じた position (= preflop caller)。 */
  caller: Position | null;
  /** caller=OOP の場合 true (= donk が定義可能)。 */
  donkApplicable: boolean;
  /** Variant が存在する限り true。 */
  cbApplicable: boolean;
  /**
   * CB を取得する FlopNode の chain。
   *  - aggressor=OOP: [] (root, OOP=aggressor が最初に動く)
   *  - aggressor=IP : ['<oop>_x'] (OOP が check した後の aggressor の番)
   *  - variant なし : null
   */
  cbNodeChain: string[] | null;
  /**
   * Donk を取得する FlopNode の chain。caller=OOP の時 [] (root)、
   * それ以外 (donkApplicable=false) は null。
   */
  donkNodeChain: string[] | null;
}

// ----------------------------------------------------------------------------
// Bet rate classification
// ----------------------------------------------------------------------------

export type BetRateSymbol = '◎' | '○' | '△' | '×' | '−';

export interface BetRateThresholds {
  /** rate ≥ high → ◎ */
  high: number;
  /** rate ≥ mid  → ○ (high 未満) */
  mid: number;
  /** rate ≥ low  → △ (mid  未満) */
  low: number;
}

export const DEFAULT_BET_RATE_THRESHOLDS: BetRateThresholds = {
  high: 0.8,
  mid: 0.5,
  low: 0.2,
};

/**
 * Bet rate (0..1) を ◎/○/△/× に分類。null は '−' (データなし)。
 *
 * 既存 `classifyByPlayRate` との違い:
 *  - スケールが 0-1 (vs 0-100)
 *  - 閾値が異なる (80/50/20 vs 90/30/10)
 *  - bet 専用 (raise+call+allin の play rate 用ではない)
 */
export function classifyByBetRate(
  rate: number | null,
  thresholds: BetRateThresholds = DEFAULT_BET_RATE_THRESHOLDS,
): BetRateSymbol {
  if (rate === null) return '−';
  if (rate >= thresholds.high) return '◎';
  if (rate >= thresholds.mid) return '○';
  if (rate >= thresholds.low) return '△';
  return '×';
}

// ----------------------------------------------------------------------------
// Bet rate computation
// ----------------------------------------------------------------------------

/**
 * Action 列から bet 頻度 (R* / RAI の合算) を 0..1 で返す。
 * 入力 action は ActionSolution[] (per-board) でも ActionTotal[] でも可。
 */
export function computeBetRate(
  actions: ReadonlyArray<ActionSolution | ActionTotal>,
): number {
  let total = 0;
  for (const a of actions) {
    if (isBetCode(a.action_code)) {
      total += a.frequency;
    }
  }
  return total;
}

/** "R<size>" | "RAI" を bet と判定 ("X" | "C" | "F" は除外)。 */
function isBetCode(code: string): boolean {
  return code === 'RAI' || code.startsWith('R');
}

/**
 * Board 指定時は solutions[name].action_solutions、未指定時は action_totals
 * を引いて bet rate を返す。指定 board が見つからない時は action_totals に fallback。
 */
export function computeBetRateFromNode(
  node: FlopNode,
  board: string | null,
): number {
  if (board !== null) {
    const sol = node.solutions.find((s) => s.name === board);
    if (sol) return computeBetRate(sol.action_solutions);
  }
  return computeBetRate(node.action_totals);
}

/**
 * CB ノードから CB 頻度を計算。
 * cbNode は root (aggressor=OOP) または flop_<oop>_x.json (aggressor=IP)。
 */
export function computeCBRate(cbNode: FlopNode, board: string | null): number {
  return computeBetRateFromNode(cbNode, board);
}

/**
 * Donk ノード (= root) から donk 頻度を計算。
 * donk が定義不能 (caller=IP のマッチアップ) の場合は null を返す。
 *
 * @param donkApplicable enumerateMatchups の MatchupCell.donkApplicable を渡す
 */
export function computeDonkRate(
  rootNode: FlopNode,
  board: string | null,
  donkApplicable: boolean,
): number | null {
  if (!donkApplicable) return null;
  return computeBetRateFromNode(rootNode, board);
}

// ----------------------------------------------------------------------------
// Matchup enumeration
// ----------------------------------------------------------------------------

/**
 * 指定 depth の全マッチアップ (6 positions C 2 = 15) をセル化して返す。
 * (oop, ip) は postflop OOP-first で canonical 化。
 *
 * Variant がデータセットに存在しないマッチアップでも cell を返す (variant=null)。
 * UI 側は variant=null を「データなし」として描画する。
 */
export function enumerateMatchups(depth: FlopReportDepth): MatchupCell[] {
  const cells: MatchupCell[] = [];
  for (let i = 0; i < REPORT_POSITIONS.length; i++) {
    for (let j = i + 1; j < REPORT_POSITIONS.length; j++) {
      const a = REPORT_POSITIONS[i];
      const b = REPORT_POSITIONS[j];
      const [oop, ip] = orderOopFirst(a, b);
      cells.push(buildMatchupCell(oop, ip, depth));
    }
  }
  return cells;
}

/**
 * 単一マッチアップを cell 化 (UI 側で symmetric 表示用に直接呼べる公開 API)。
 *
 * @throws oop === ip の場合
 */
export function buildMatchupCell(
  oop: Position,
  ip: Position,
  depth: FlopReportDepth,
): MatchupCell {
  if (oop === ip) {
    throw new Error(`oop and ip must differ: got ${oop}`);
  }
  const variant = findFlopVariantFromUI([oop, ip], depth);
  if (variant === null) {
    return {
      oop,
      ip,
      depth,
      variant: null,
      aggressor: null,
      caller: null,
      donkApplicable: false,
      cbApplicable: false,
      cbNodeChain: null,
      donkNodeChain: null,
    };
  }

  const opener = getFlopOpener(variant);
  const responder = getFlopResponder(variant);
  const caller = getFlopCaller(variant);
  // aggressor = preflop の最終 raiser = opener と responder のうち caller でない方。
  // SRP/4bp は opener、3bp/5bp は responder が aggressor になる。
  const aggressor = caller === opener ? responder : opener;
  const callerIsOOP = caller === oop;
  const aggressorIsOOP = aggressor === oop;

  return {
    oop,
    ip,
    depth,
    variant,
    aggressor,
    caller,
    donkApplicable: callerIsOOP,
    cbApplicable: true,
    cbNodeChain: aggressorIsOOP ? [] : [`${oop.toLowerCase()}_x`],
    donkNodeChain: callerIsOOP ? [] : null,
  };
}

function orderOopFirst(a: Position, b: Position): [Position, Position] {
  const ia = POSTFLOP_ORDER.indexOf(a);
  const ib = POSTFLOP_ORDER.indexOf(b);
  return ia <= ib ? [a, b] : [b, a];
}

// ----------------------------------------------------------------------------
// Single-cell fetch wrapper
// ----------------------------------------------------------------------------

export interface FlopReportCellResult {
  variant: string;
  depth: FlopReportDepth;
  /** 対象 board (null = 全ボード平均)。 */
  board: string | null;
  /** Caller=IP の場合 null。0..1。 */
  donkRate: number | null;
  /** 0..1。 */
  cbRate: number;
  donkSymbol: BetRateSymbol;
  cbSymbol: BetRateSymbol;
}

/**
 * 1 セル分のレポートデータを取得 (R2 fetch を内包)。
 *
 *  - aggressor=OOP: root 1 ノードのみ fetch (= CB ノード、donk N/A)
 *  - aggressor=IP : root + flop_<oop>_x.json の 2 ノードを並列 fetch
 *
 * Phase 1 spec の `loadFlopReportCell(variant, depth, board, betRate)` の 4 番目
 * 引数は thresholds に正規化。
 *
 * @throws variant がデータセットに存在しない場合 / fetch 失敗 / depth 不一致
 */
export async function loadFlopReportCell(
  variant: string,
  depth: FlopReportDepth,
  board: string | null,
  thresholds: BetRateThresholds = DEFAULT_BET_RATE_THRESHOLDS,
  signal?: AbortSignal,
): Promise<FlopReportCellResult> {
  // Variant から (oop, ip) を逆引き、cell を再構築する (donkApplicable 等の取得)。
  const opener = getFlopOpener(variant);
  const responder = getFlopResponder(variant);
  const [oop, ip] = orderOopFirst(opener, responder);
  const cell = buildMatchupCell(oop, ip, depth);
  if (cell.variant !== variant) {
    throw new Error(
      `Variant mismatch: passed "${variant}", but (${oop}, ${ip}, ${depth}) maps to "${cell.variant ?? 'null'}"`,
    );
  }

  let donkRate: number | null = null;
  let cbRate: number;

  if (cell.donkApplicable) {
    // aggressor=IP: root = donk node, flop_<oop>_x = CB node
    const [rootNode, cbNode] = await Promise.all([
      fetchFlopNode(variant, cell.donkNodeChain ?? [], signal),
      fetchFlopNode(variant, cell.cbNodeChain ?? [], signal),
    ]);
    donkRate = computeBetRateFromNode(rootNode, board);
    cbRate = computeBetRateFromNode(cbNode, board);
  } else {
    // aggressor=OOP: root = CB node, no donk
    const rootNode = await fetchFlopNode(variant, cell.cbNodeChain ?? [], signal);
    cbRate = computeBetRateFromNode(rootNode, board);
  }

  return {
    variant,
    depth,
    board,
    donkRate,
    cbRate,
    donkSymbol: classifyByBetRate(donkRate, thresholds),
    cbSymbol: classifyByBetRate(cbRate, thresholds),
  };
}
