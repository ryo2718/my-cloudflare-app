// 復習モード: missed_problems から取得した row を IntermediateQuestion に復元するヘルパー。
//
// DB に保存しているのは「scenario_type / hero_position / opener_position /
// three_bettor_position / hand / gto_strategy」など最小情報のみ。
// foldedBefore / chipExtras はシナリオに従って実行時に再計算する。

import type { MissedProblemRow } from '../../api/missedProblems';
import {
  handToCards,
  positionsBefore,
  positionsBetween,
} from './preflopBeginner';
import type {
  ChipExtra,
  IntermediateQuestion,
  IntermediateScenarioType,
} from './preflopIntermediate';
import type { Hand, Position } from '../../types/strategy';

const VALID_SCENARIOS: ReadonlyArray<IntermediateScenarioType> = [
  'bb_response',
  'vs_3bet',
  'vs_4bet',
  'middle_vs_open',
  'risky_open',
];

const OPEN_SIZE = 2.5;
const THREE_BET_SIZE = 12;
const FOUR_BET_SIZE = 30;

interface ParsedStrategy {
  allin: number;
  raise: number;
  call: number;
  fold: number;
}

/** 安全に JSON parse。 失敗時はゼロ戦略にフォールバック。 */
function parseStrategy(raw: string): ParsedStrategy {
  try {
    const obj = JSON.parse(raw) as Partial<ParsedStrategy>;
    return {
      allin: typeof obj.allin === 'number' ? obj.allin : 0,
      raise: typeof obj.raise === 'number' ? obj.raise : 0,
      call: typeof obj.call === 'number' ? obj.call : 0,
      fold: typeof obj.fold === 'number' ? obj.fold : 0,
    };
  } catch {
    return { allin: 0, raise: 0, call: 0, fold: 0 };
  }
}

function isValidScenario(s: string): s is IntermediateScenarioType {
  return (VALID_SCENARIOS as ReadonlyArray<string>).includes(s);
}

/**
 * missed_problems の 1 行を IntermediateQuestion に変換 (中級専用、preflop_intermediate のみ)。
 * scenario_type に応じて foldedBefore / chipExtras を再計算。
 * 不正なデータの場合 null。
 */
export function recordToIntermediateQuestion(
  row: MissedProblemRow,
): IntermediateQuestion | null {
  if (row.training_type !== 'preflop_intermediate') return null;
  if (!isValidScenario(row.scenario_type)) return null;
  const me = row.hero_position as Position;
  const opener = (row.opener_position ?? row.hero_position) as Position;
  const threeBettor = row.three_bettor_position
    ? (row.three_bettor_position as Position)
    : undefined;
  const hand = row.hand as Hand;
  const strategy = parseStrategy(row.gto_strategy);

  let foldedBefore: Position[] = [];
  let chipExtras: ChipExtra[] = [];

  switch (row.scenario_type) {
    case 'bb_response':
      foldedBefore = [
        ...positionsBefore(opener),
        ...positionsBetween(opener, me),
      ];
      chipExtras = [{ position: opener, amount: OPEN_SIZE }];
      break;
    case 'middle_vs_open':
      foldedBefore = [
        ...positionsBefore(opener),
        ...positionsBetween(opener, me),
      ];
      chipExtras = [{ position: opener, amount: OPEN_SIZE }];
      break;
    case 'vs_3bet':
      if (!threeBettor) return null;
      foldedBefore = [
        ...positionsBefore(opener),
        ...positionsBetween(opener, threeBettor),
      ];
      chipExtras = [
        { position: opener, amount: OPEN_SIZE },
        { position: threeBettor, amount: THREE_BET_SIZE },
      ];
      break;
    case 'vs_4bet':
      if (!threeBettor) return null;
      foldedBefore = [
        ...positionsBefore(opener),
        ...positionsBetween(opener, threeBettor),
      ];
      chipExtras = [
        { position: opener, amount: FOUR_BET_SIZE },
        { position: threeBettor, amount: THREE_BET_SIZE },
      ];
      break;
    case 'risky_open':
      foldedBefore = positionsBefore(opener);
      chipExtras = [];
      break;
  }

  return {
    scenarioType: row.scenario_type,
    myPosition: me,
    opener,
    threeBettor,
    foldedBefore,
    chipExtras,
    hand,
    cards: handToCards(hand),
    strategy,
  };
}

/** row 配列をまとめて変換、不正な row は除外。 */
export function recordsToQuestions(
  rows: ReadonlyArray<MissedProblemRow>,
): IntermediateQuestion[] {
  const out: IntermediateQuestion[] = [];
  for (const r of rows) {
    const q = recordToIntermediateQuestion(r);
    if (q) out.push(q);
  }
  return out;
}
