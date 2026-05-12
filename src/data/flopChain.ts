// Flop アクションチェーン (= `_meta.action_chain` 形式の `string[]`) ↔ ファイル名 の変換。
//
// 各チェーンステップは `"<actor>_<action>"` 形式の文字列:
//   - actor: "bb" | "sb" | "utg" | "hj" | "co" | "btn"
//   - action: "x" (check) | "c" (call) | "f" (fold)
//             | "b<size>" (最初の aggressive、bet)
//             | "r<size>" (二度目以降の aggressive、raise)
//             | "bAI" / "rAI" (all-in、最初/再 aggressive)
//   - size 部分の `.` は `_` 置換 (例: R6.35 → r6_35)
//
// 移植元: webscraping/gtowizard/REPORT_FOR_APP_MIGRATION.md の Python helper。

import type { FlopActor } from '../types/flop';

const ACTORS = ['bb', 'sb', 'utg', 'hj', 'co', 'btn'] as const;
type Actor = (typeof ACTORS)[number];

function isActor(s: string): s is Actor {
  return (ACTORS as readonly string[]).includes(s);
}

// ----------------------------------------------------------------------------
// chain → filename
// ----------------------------------------------------------------------------

/**
 * チェーン配列 (`_meta.action_chain` 形式) からファイル名を生成。
 *
 * @param variant variant 名 (現在は未使用、将来的な validation 用に保持)
 * @param chain 各ステップが `"<actor>_<action>"` 形式の文字列。空配列 = root。
 * @returns 例: `[]` → "flop_root.json"、
 *               `["bb_b1_8"]` → "flop_bb_b1_8.json"、
 *               `["bb_x", "utg_b1_8"]` → "flop_bb_x_utg_b1_8.json"
 */
export function chainToFilename(variant: string, chain: string[]): string {
  void variant; // reserved for future validation
  if (chain.length === 0) return 'flop_root.json';
  return `flop_${chain.join('_')}.json`;
}

// ----------------------------------------------------------------------------
// filename → chain
// ----------------------------------------------------------------------------

/**
 * ファイル名からチェーン配列を復元。
 *
 * "flop_bb_x_utg_b1_8.json" → ["bb_x", "utg_b1_8"]
 * "flop_root.json"           → []
 *
 * アルゴリズム: prefix/suffix を剥がして `_` で split、actor 名 (bb/sb/...) を
 * 境界として step を grouping する。
 */
export function filenameToChain(filename: string): string[] {
  if (filename === 'flop_root.json') return [];

  const m = filename.match(/^flop_(.+)\.json$/);
  if (!m) {
    throw new Error(`Invalid flop filename: "${filename}"`);
  }

  const tokens = m[1].split('_');
  const result: string[] = [];
  let current: string[] = [];

  for (const tok of tokens) {
    if (isActor(tok)) {
      if (current.length > 0) result.push(current.join('_'));
      current = [tok];
    } else {
      current.push(tok);
    }
  }
  if (current.length > 0) result.push(current.join('_'));

  return result;
}

// ----------------------------------------------------------------------------
// Single-step encoder (action_code → chain step token)
// ----------------------------------------------------------------------------

/**
 * 1 ステップを encode。`game_point.available_actions[i].action.code` のような
 * "F" | "C" | "X" | "RAI" | "R<size>" 形式から、`action_chain` 内のトークン
 * "<actor>_<encoded>" 形式へ変換する。
 *
 * isFirstAggression に応じて `b<size>` / `r<size>` (および `bAI` / `rAI`) を切替。
 *
 * @param actor 小文字ポジション (例: "bb", "utg")
 * @param actionCode 大文字アクション識別子 (例: "X", "C", "R1.8", "RAI")
 * @param afterAggression true なら "r-prefix" (再 aggressive)、false なら "b-prefix" (最初の aggressive)
 */
export function encodeStep(
  actor: FlopActor,
  actionCode: string,
  afterAggression: boolean,
): string {
  if (actionCode === 'X') return `${actor}_x`;
  if (actionCode === 'C') return `${actor}_c`;
  if (actionCode === 'F') return `${actor}_f`;
  if (actionCode === 'RAI') {
    return `${actor}_${afterAggression ? 'rAI' : 'bAI'}`;
  }
  if (actionCode.startsWith('R')) {
    const size = actionCode.slice(1).replace(/\./g, '_');
    return `${actor}_${afterAggression ? 'r' : 'b'}${size}`;
  }
  throw new Error(`Unknown action code: "${actionCode}"`);
}

// ----------------------------------------------------------------------------
// Chain inspection
// ----------------------------------------------------------------------------

/**
 * Chain 内に既に aggressive action (`b<size>` / `r<size>` / `bAI` / `rAI`) が
 * 含まれているかを判定。次の R<size> アクションを bet (b prefix) か raise (r prefix)
 * のどちらで encode するかの判定に使う。
 */
export function hasAggressionInChain(chain: string[]): boolean {
  for (const step of chain) {
    const actionPart = step.split('_').slice(1).join('_');
    if (actionPart.startsWith('b') || actionPart.startsWith('r')) return true;
  }
  return false;
}
