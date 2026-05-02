import type {
  Action,
  Metadata,
  Position,
  ScenarioType,
  Strategy,
  StrategyData,
  TableSize,
} from '../types/strategy';

// SCHEMA v1.1.0 — see docs/SCHEMA.md
// 4-action固定 (fold/call/raise/allin)、確率は 0–100 (%)、ツリーノード形式。

interface ActionHistoryEntry {
  position: string;
  action: string;
}

interface SolutionMeta {
  game_type?: string;
  stack?: string | number;
  players?: string;
  rake?: string;
  type?: string;
  opening_size?: string;
  bet_sizes?: string;
  postflop_bet_sizes?: string;
}

interface GameInfo {
  scenario: string;
  node_path: string;
  step: number;
  hero_position: string;
  active_positions: string[];
  folded_positions: string[];
  action_history: ActionHistoryEntry[];
  is_leaf: boolean;
  available_actions_at_this_node: string[];
  solution: SolutionMeta;
  cash_settings?: Record<string, unknown>;
}

interface RawHandStrategy {
  fold: number;
  call: number;
  raise: number;
  allin: number;
}

export interface RawStrategyFile {
  game_info: GameInfo;
  actions_legend: Record<string, string>;
  hands: Record<string, RawHandStrategy>;
}

const FIXED_ACTIONS: ReadonlyArray<Action> = [
  { id: 'fold',  label: 'Fold',   size_bb: 0,   color: '#0284c7' },
  { id: 'call',  label: 'Call',   size_bb: 1,   color: '#16a34a' },
  { id: 'raise', label: 'Raise',  size_bb: 0,   color: '#ef4444' },
  { id: 'allin', label: 'All-in', size_bb: 100, color: '#9333ea' },
];

const COMBOS_BY_HAND_TYPE = (hand: string): number => {
  if (hand.length === 2) return 6;          // Pair (e.g., "AA")
  if (hand.endsWith('s')) return 4;         // Suited
  if (hand.endsWith('o')) return 12;        // Offsuit
  return 0;
};
const TOTAL_COMBOS = 1326;

const POSITIONS: ReadonlyArray<Position> = ['UTG', 'HJ', 'MP', 'CO', 'BTN', 'SB', 'BB'];
const isPosition = (p: string | undefined): p is Position =>
  p !== undefined && (POSITIONS as ReadonlyArray<string>).includes(p);

const STEP_TO_SCENARIO_TYPE: Record<number, ScenarioType> = {
  1: 'rfi',
  2: 'vs_rfi',
  3: 'vs_3bet',
  4: 'vs_4bet',
  5: 'vs_5bet',
};

function parseStackBb(stack: string | number | undefined, fallback = 100): number {
  if (typeof stack === 'number') return stack;
  if (!stack) return fallback;
  const m = String(stack).match(/(\d+)/);
  return m ? Number(m[1]) : fallback;
}

function parseTableSize(players: string | undefined): TableSize {
  if (players === '6max') return '6max';
  if (players === '9max') return '9max';
  if (players === 'hu' || players === 'HU' || players === 'heads-up') return 'hu';
  return '6max';
}

function parseSizeFromAction(action: string): number | null {
  const m = action.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** action_history からポット・to_call を導出。step に依存せず汎用的に動く。 */
function computePotAndToCall(
  history: ActionHistoryEntry[],
  hero: Position | null,
  stackBb: number,
): { pot_bb: number; to_call_bb: number } {
  const contrib: Record<string, number> = {
    UTG: 0, HJ: 0, MP: 0, CO: 0, BTN: 0, SB: 0.5, BB: 1.0,
  };
  let lastBet = 1.0; // BB
  for (const entry of history) {
    const a = entry.action;
    if (a === 'Fold') continue;
    if (a === 'Call') {
      contrib[entry.position] = lastBet;
    } else if (a.startsWith('Raise')) {
      const size = parseSizeFromAction(a);
      if (size != null) {
        contrib[entry.position] = size;
        lastBet = size;
      }
    } else if (a === 'Allin' || a.toLowerCase() === 'allin') {
      contrib[entry.position] = stackBb;
      lastBet = stackBb;
    }
  }
  const pot = Object.values(contrib).reduce((a, b) => a + b, 0);
  const heroContrib = hero ? contrib[hero] ?? 0 : 0;
  const toCall = Math.max(0, lastBet - heroContrib);
  return {
    pot_bb: Math.round(pot * 10) / 10,
    to_call_bb: Math.round(toCall * 10) / 10,
  };
}

/** 非foldの組み合わせ加重% (RFI ノードでは open_rate に一致)。 */
function computeOpenRatePct(hands: Record<string, RawHandStrategy>): number {
  let weightedNonFold = 0;
  for (const [hand, h] of Object.entries(hands)) {
    const w = COMBOS_BY_HAND_TYPE(hand);
    weightedNonFold += ((100 - h.fold) * w) / 100;
  }
  return (weightedNonFold / TOTAL_COMBOS) * 100;
}

export function normalize(raw: RawStrategyFile, scenarioId: string): StrategyData {
  const gi = raw.game_info;
  const handEntries = Object.entries(raw.hands);
  if (handEntries.length === 0) {
    throw new Error(`normalize: no hands in ${scenarioId}`);
  }

  // 4アクション固定 — 各ハンド [fold, call, raise, allin] を 0–1 化
  const strategy: Record<string, number[]> = {};
  for (const [hand, h] of handEntries) {
    strategy[hand] = [
      (h.fold ?? 0) / 100,
      (h.call ?? 0) / 100,
      (h.raise ?? 0) / 100,
      (h.allin ?? 0) / 100,
    ];
  }

  const heroPos: Position | null = isPosition(gi.hero_position) ? gi.hero_position : null;
  const villainPos: Position | null = (() => {
    // 直近で raise/all-in した相手 (hero 以外) を villain と推定
    for (let i = gi.action_history.length - 1; i >= 0; i--) {
      const e = gi.action_history[i];
      if (e.position === gi.hero_position) continue;
      if (e.action.startsWith('Raise') || e.action === 'Allin') {
        return isPosition(e.position) ? e.position : null;
      }
    }
    return null;
  })();

  const stackBb = parseStackBb(gi.solution?.stack);
  const tableSize = parseTableSize(gi.solution?.players);
  const { pot_bb, to_call_bb } = computePotAndToCall(gi.action_history, heroPos, stackBb);

  const scenarioType: ScenarioType = STEP_TO_SCENARIO_TYPE[gi.step] ?? '6bet_ai';
  const open_rate_pct = computeOpenRatePct(raw.hands);

  const metadata: Metadata = {
    scenario_id: scenarioId,
    scenario_name: gi.scenario,
    table_size: tableSize,
    stack_bb: stackBb,
    hero_position: heroPos,
    villain_position: villainPos,
    scenario_type: scenarioType,
    pot_bb,
    to_call_bb,
    description: gi.scenario,
    source: `GTO Wizard (${gi.solution?.rake ?? '?'} ${gi.solution?.opening_size ?? '?'})`,
    open_rate_pct,
  };

  return {
    schema_version: '1.1.0',
    metadata,
    actions: [...FIXED_ACTIONS],
    strategy: strategy as Strategy,
  };
}
