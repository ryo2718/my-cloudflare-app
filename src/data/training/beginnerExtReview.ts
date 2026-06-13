// 復習モード: missed_problems の row を 初級拡張モード (オープン / vs オープン / vs 3bet4bet) の
// 問題に復元するヘルパー。MissedChallengePlayPage / MissedProblemAnswerPage で共有する。
//
// DB に保存しているのは scenario_type / hero / opener / three_bettor / hand / gto_strategy など。
// ノードファイルと正解はこれらから再構築する (詳細は preflopBeginnerOpen / VsOpen / Vs3Bet4Bet と対応)。

import { handToCards, type HandStrategy, type PreflopQuestion } from './preflopBeginner';
import type { MissedProblemRow } from '../../api/missedProblems';
import type { Hand, Position } from '../../types/strategy';

/** 初級拡張モードの復習種別。 */
export type ExtReviewKind = 'open' | 'select';

/** オープン (slider) の復習問題。 */
export interface OpenReviewQuestion {
  hand: Hand;
  position: Position;
  nodeFile: string;
  /** 正解レイズ% (0-100)。 */
  raisePct: number;
  cards: PreflopQuestion['cards'];
}

/** vs オープン / vs 3bet4bet (複数選択) の復習問題。 */
export interface SelectReviewQuestion {
  hand: Hand;
  hero: Position;
  nodeFile: string;
  strategy: HandStrategy;
  scenarioLabel: string;
  cards: PreflopQuestion['cards'];
}

function parseStrategy(raw: string): HandStrategy {
  try {
    const o = JSON.parse(raw) as Partial<HandStrategy>;
    return {
      allin: typeof o.allin === 'number' ? o.allin : 0,
      raise: typeof o.raise === 'number' ? o.raise : 0,
      call: typeof o.call === 'number' ? o.call : 0,
      fold: typeof o.fold === 'number' ? o.fold : 0,
    };
  } catch {
    return { allin: 0, raise: 0, call: 0, fold: 0 };
  }
}

/** training_type から復習種別を判定。初級拡張モードでなければ null。 */
export function classifyExtRow(row: MissedProblemRow): ExtReviewKind | null {
  switch (row.training_type) {
    case 'preflop_beginner_open':
      return 'open';
    case 'preflop_beginner_vs_open':
    case 'preflop_beginner_vs_3bet_4bet':
      return 'select';
    default:
      return null;
  }
}

/** row → ノードファイル名 (scenario_type + ポジションから再構築)。 */
export function extNodeFile(row: MissedProblemRow): string | null {
  const hero = (row.hero_position ?? '').toLowerCase();
  const opener = (row.opener_position ?? '').toLowerCase();
  const tb = (row.three_bettor_position ?? '').toLowerCase();
  switch (row.scenario_type) {
    case 'beginner_open':
      return hero ? `${hero}.json` : null;
    case 'beginner_vs_open':
      return opener && hero ? `${opener}r_${hero}.json` : null;
    case 'beginner_vs_3bet':
      // hero = opener が 3bet に直面。
      return opener && tb ? `${opener}r_${tb}r_${opener}.json` : null;
    case 'beginner_vs_4bet':
      // hero = 3bettor が 4bet に直面。
      return opener && tb ? `${opener}r_${tb}r_${opener}r_${tb}.json` : null;
    default:
      return null;
  }
}

/** row → シナリオ表示ラベル。 */
export function extScenarioLabel(row: MissedProblemRow): string {
  const hero = row.hero_position ?? '?';
  const opener = row.opener_position ?? '?';
  const tb = row.three_bettor_position ?? '?';
  switch (row.scenario_type) {
    case 'beginner_open':
      return `${hero} オープン`;
    case 'beginner_vs_open':
      return `${hero} vs ${opener} オープン`;
    case 'beginner_vs_3bet':
      return `${hero} vs ${tb} 3bet`;
    case 'beginner_vs_4bet':
      return `${hero} vs ${opener} 4bet`;
    default:
      return row.scenario_type;
  }
}

/** row → オープン復習問題 (slider)。 */
export function recordToOpenReview(row: MissedProblemRow): OpenReviewQuestion | null {
  if (row.training_type !== 'preflop_beginner_open') return null;
  const nodeFile = extNodeFile(row);
  if (!nodeFile) return null;
  const strategy = parseStrategy(row.gto_strategy);
  const hand = row.hand as Hand;
  return {
    hand,
    position: row.hero_position as Position,
    nodeFile,
    raisePct: strategy.raise ?? 0,
    cards: handToCards(hand),
  };
}

/** row → 複数選択復習問題 (vs オープン / vs 3bet4bet)。 */
export function recordToSelectReview(row: MissedProblemRow): SelectReviewQuestion | null {
  if (row.training_type !== 'preflop_beginner_vs_open' && row.training_type !== 'preflop_beginner_vs_3bet_4bet') {
    return null;
  }
  const nodeFile = extNodeFile(row);
  if (!nodeFile) return null;
  const hand = row.hand as Hand;
  return {
    hand,
    hero: row.hero_position as Position,
    nodeFile,
    strategy: parseStrategy(row.gto_strategy),
    scenarioLabel: extScenarioLabel(row),
    cards: handToCards(hand),
  };
}
