// プリフロップ GTO ソリューション (cash_100bb_6max_nl500_2.5x) から、
// 「頻度付きレンジ」(コンボ key → weight 0..1) を構築する。
//
// ノードファイル名はアクション履歴をエンコード:
//   open      : {hero}                       (例 co)
//   vs open   : {opp}r_{hero}                (例 cor_bb = CO open → BB)
//   vs 3bet   : {hero}r_{opp}r_{hero}        (例 cor_bbr_co = CO open → BB 3bet → CO)
//   vs 4bet   : {opp}r_{hero}r_{opp}r_{hero} (例 cor_bbr_cor_bb = ... CO 4bet → BB)
// 参加頻度 = (raise + call + allin) / 100 (= fold しない頻度) を weight とする。
// 存在判定は AVAILABLE_NODE_PATHS で行い、無いノードは選択不可。

import type { Position } from '../types/strategy';
import { AVAILABLE_NODE_PATHS } from '../data/availableNodes';
import { combosOfHand, comboKeyOf, handAt } from './combos';

export const PREFLOP_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';
export const SOLUTION_LABEL = '6max NL500 100bb open 2.5x';

/** 本ソリューションで扱うポジション (プリフロップ行動順)。MP は無し。 */
export const PRESET_POSITIONS: ReadonlyArray<Position> = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export type Scenario = 'open' | 'vsopen' | 'vs3bet' | 'vs4bet';

export const SCENARIOS: ReadonlyArray<{ key: Scenario; label: string }> = [
  { key: 'open', label: 'open' },
  { key: 'vsopen', label: 'vs open' },
  { key: 'vs3bet', label: 'vs 3bet' },
  { key: 'vs4bet', label: 'vs 4bet' },
];

interface NodeHandFreq {
  allin?: number;
  raise?: number;
  call?: number;
  fold?: number;
}
export interface PreflopNode {
  hands?: Record<string, NodeHandFreq>;
}

const low = (p: Position): string => p.toLowerCase();

/** (hero, シナリオ, 相手) に対応するノードパス。存在しなければ null。 */
export function nodePathFor(hero: Position, scenario: Scenario, opp: Position | null): string | null {
  const h = low(hero);
  let path: string;
  if (scenario === 'open') {
    path = h;
  } else {
    if (!opp) return null;
    const o = low(opp);
    if (scenario === 'vsopen') path = `${o}r_${h}`;
    else if (scenario === 'vs3bet') path = `${h}r_${o}r_${h}`;
    else path = `${o}r_${h}r_${o}r_${h}`; // vs4bet
  }
  return AVAILABLE_NODE_PATHS.has(path) ? path : null;
}

/** そのシナリオで選べる相手ポジション (存在するノードのみ)。 */
export function availableOpponents(hero: Position, scenario: Scenario): Position[] {
  if (scenario === 'open') return [];
  return PRESET_POSITIONS.filter((opp) => opp !== hero && nodePathFor(hero, scenario, opp) !== null);
}

/** そのシナリオが (どれかの相手で) 選択可能か。 */
export function scenarioAvailable(hero: Position, scenario: Scenario): boolean {
  if (scenario === 'open') return nodePathFor(hero, 'open', null) !== null;
  return availableOpponents(hero, scenario).length > 0;
}

/** ノード JSON → 頻度付きレンジ (コンボ key → weight 0..1)。weight 0 は含めない。 */
export function rangeFromNode(node: PreflopNode): Map<string, number> {
  const hands = node.hands ?? {};
  const map = new Map<string, number>();
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const h = handAt(row, col);
      const fr = hands[h.label];
      if (!fr) continue;
      const part = ((fr.raise ?? 0) + (fr.call ?? 0) + (fr.allin ?? 0)) / 100;
      if (part <= 0) continue;
      const w = Math.min(1, part);
      for (const [a, b] of combosOfHand(h)) map.set(comboKeyOf(a, b), w);
    }
  }
  return map;
}

/** ノードを fetch して頻度付きレンジに変換。 */
export async function fetchPresetRange(nodePath: string): Promise<Map<string, number>> {
  const res = await fetch(`${PREFLOP_ROOT}/${nodePath}.json`);
  if (!res.ok) throw new Error(`failed to load preset node: ${nodePath}`);
  const node = (await res.json()) as PreflopNode;
  return rangeFromNode(node);
}
