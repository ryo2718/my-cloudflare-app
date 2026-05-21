// 中級ポジション別: 振り返り / 挑戦モード / 間違えた問題集 のための変換ヘルパー。
//
//   - PositionalQuestion ⇄ missed_problems の行 (再構築 / エンコード)
//   - スライダー回答は user_selections に ['__slider__','<回答%>'] として保存
//   - 飛ばしは ['__skip__']、時間切れは is_timeout=1 + 空配列

import type { MissedProblemRow, MissedProblemInput, MissedTrainingType } from '../../api/missedProblems';
import { handToCards } from './preflopBeginner';
import {
  scenarioFormat,
  scenarioLimp,
  labelsForScenario,
  availableActionsOf,
  positionalTableInfo,
  positionalTrainingType,
  isPositionalScenario,
  type PositionalQuestion,
  type PositionalStrategy,
  type PositionalAction,
  type PositionalMode,
  type PositionalResponse,
} from './preflopIntermediatePositional';
import type { Hand, Position } from '../../types/strategy';

export const SLIDER_SENTINEL = '__slider__';
export const SKIP_SENTINEL = '__skip__';

const POS_ACTIONS: ReadonlyArray<PositionalAction> = ['allin', 'raise', 'call', 'check', 'fold'];

function parseStrategy(raw: string): PositionalStrategy {
  try {
    const o = JSON.parse(raw) as Partial<PositionalStrategy>;
    return {
      allin: typeof o.allin === 'number' ? o.allin : 0,
      raise: typeof o.raise === 'number' ? o.raise : 0,
      call: typeof o.call === 'number' ? o.call : 0,
      check: typeof o.check === 'number' ? o.check : 0,
      fold: typeof o.fold === 'number' ? o.fold : 0,
    };
  } catch {
    return { allin: 0, raise: 0, call: 0, check: 0, fold: 0 };
  }
}

/** strategy から非ゼロアクションを抽出 (ノード未取得時の available フォールバック)。 */
function actionsFromStrategy(s: PositionalStrategy): PositionalAction[] {
  return POS_ACTIONS.filter((a) => (s[a] ?? 0) > 0);
}

export function modeFromTrainingType(t: string): PositionalMode | null {
  if (t === 'preflop_intermediate_ep') return 'ep';
  if (t === 'preflop_intermediate_lp') return 'lp';
  if (t === 'preflop_intermediate_blind') return 'blind';
  return null;
}

/** missed_problems 行がポジション別か。 */
export function isPositionalRow(row: MissedProblemRow): boolean {
  return modeFromTrainingType(row.training_type) !== null;
}

export interface DecodedAnswer {
  response: PositionalResponse;
  /** 表示用: スライダー回答 % (slider のみ)。 */
  sliderPct?: number;
}

/** user_selections (JSON 文字列) → 回答。 */
export function decodeAnswer(row: MissedProblemRow): DecodedAnswer {
  if (row.is_timeout) return { response: { kind: 'timeout' } };
  let arr: string[] = [];
  try {
    const parsed = JSON.parse(row.user_selections) as unknown;
    if (Array.isArray(parsed)) arr = parsed.map((x) => String(x));
  } catch {
    arr = [];
  }
  if (arr[0] === SKIP_SENTINEL) return { response: { kind: 'skip' } };
  if (arr[0] === SLIDER_SENTINEL) {
    const pct = Number(arr[1] ?? 0);
    return { response: { kind: 'slider', pct }, sliderPct: pct };
  }
  const selections = arr.filter((a): a is PositionalAction =>
    (POS_ACTIONS as ReadonlyArray<string>).includes(a),
  );
  return { response: { kind: 'select', selections } };
}

/**
 * missed_problems の 1 行を PositionalQuestion に復元。
 * nodeHands を渡せばノード全体の available アクションを使う (挑戦モード推奨)。
 * 渡さなければ gto_strategy の非ゼロから推定 (答え合わせ画面用)。
 */
export function recordToPositionalQuestion(
  row: MissedProblemRow,
  nodeHands?: Record<string, PositionalStrategy> | null,
): PositionalQuestion | null {
  const mode = modeFromTrainingType(row.training_type);
  if (!mode) return null;
  const scenarioKey = row.scenario_type;
  if (!isPositionalScenario(scenarioKey)) return null;

  const hero = row.hero_position as Position;
  const opener = (row.opener_position ?? null) as Position | null;
  const threeBettor = row.three_bettor_position
    ? (row.three_bettor_position as Position)
    : undefined;
  const hand = row.hand as Hand;
  const strategy = parseStrategy(row.gto_strategy);
  const info = positionalTableInfo(scenarioKey, { hero, opener, threeBettor });
  const available = nodeHands ? availableActionsOf(nodeHands) : actionsFromStrategy(strategy);

  return {
    mode,
    scenarioKey,
    label: info.label,
    format: scenarioFormat(scenarioKey),
    myPosition: hero,
    opener: info.opener,
    threeBettor,
    foldedBefore: info.foldedBefore,
    chipExtras: info.chipExtras,
    hand,
    cards: handToCards(hand),
    strategy,
    sliderAction: 'raise',
    sliderCorrectPct: strategy.raise,
    availableActions: available,
    actionLabels: labelsForScenario(scenarioKey),
    limpAction: scenarioLimp(scenarioKey),
  };
}

/** PositionalQuestion + 回答 + 素点 → 間違えた問題 POST 用入力。 */
export function encodeMissedInput(
  q: PositionalQuestion,
  response: PositionalResponse,
  points: number,
): MissedProblemInput {
  let userSelections: string[] = [];
  let isTimeout = false;
  if (response.kind === 'timeout') {
    isTimeout = true;
  } else if (response.kind === 'skip') {
    userSelections = [SKIP_SENTINEL];
  } else if (response.kind === 'slider') {
    userSelections = [SLIDER_SENTINEL, String(response.pct)];
  } else {
    userSelections = [...response.selections];
  }
  return {
    training_type: positionalTrainingType(q.mode) as MissedTrainingType,
    scenario_type: q.scenarioKey,
    hero_position: q.myPosition,
    opener_position: q.opener ?? null,
    three_bettor_position: q.threeBettor ?? null,
    hand: q.hand,
    user_selections: userSelections,
    gto_strategy: {
      allin: q.strategy.allin,
      raise: q.strategy.raise,
      call: q.strategy.call,
      check: q.strategy.check,
      fold: q.strategy.fold,
    },
    score_obtained: points,
    is_timeout: isTimeout,
  };
}

/** 間違えた問題行 → 日本語シナリオラベル (リスト/答え合わせ用)。 */
export function positionalRowLabel(row: MissedProblemRow): string {
  const q = recordToPositionalQuestion(row);
  return q ? q.label : row.scenario_type;
}
