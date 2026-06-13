// フロップ「間違えた問題」の記録入力・ラベル・再構築のユニットテスト (純粋関数)。

import { describe, it, expect } from 'vitest';
import type { Rank, Suit } from '../../types/card';
import type { MissedProblemRow } from '../../api/missedProblems';
import {
  boardToString,
  displayBoard,
  flopRbMissedInput,
  flopBeginnerMissedInput,
  flopMissedLabel,
  parseFlopMeta,
} from './flopMissedMode';
import {
  recordToFlopRbQuestion,
  type FlopRbData,
  type FlopRbQuestion,
} from './flopIntermediateCb';
import {
  recordToFlopBeginnerQuestion,
  type FlopTrainingData,
  type FlopQuestion,
} from './flopBeginner';

const C = (r: string, s: string) => ({ rank: r as Rank, suit: s as Suit });

function rbQuestion(): FlopRbQuestion {
  return {
    id: 1, pot: 'SRP', kind: 'cb', variant: 'cor_btnc', hero: 'CO', villain: 'BTN',
    board: [C('A', 'd'), C('A', 'c'), C('3', 'd')],
    choices: ['check', '33', '50'], strat: { check: 0.4, '33': 0.6 }, preflopActions: [], similar: [],
  };
}

function beginnerQuestion(): FlopQuestion {
  return {
    id: 1, type: 'cb', pot: 'SRP', variant: 'v1', hero: 'BTN', villain: 'BB',
    board: [C('8', 'h'), C('8', 'd'), C('8', 'c')],
    rate: 0.9, threshold: 0.7, correct: 'bet', actions: [], preflopActions: [],
  };
}

function rowWith(meta: object, over: Partial<MissedProblemRow> = {}): MissedProblemRow {
  return {
    id: 1, account_id: 1, training_type: 'srp_non_blind', scenario_type: 'flop_cb',
    hero_position: 'BTN', opener_position: 'BB', three_bettor_position: null, hand: '-',
    user_selections: '[]', gto_strategy: '{}', score_obtained: 0, is_timeout: 0,
    is_removed_from_review: 0, created_at: 0, metadata: JSON.stringify(meta), ...over,
  };
}

describe('flopMissedMode board 変換', () => {
  it('boardToString / displayBoard', () => {
    expect(boardToString([C('A', 'd'), C('A', 'c'), C('3', 'd')])).toBe('AdAc3d');
    expect(displayBoard('AdAc3d')).toBe('Ad Ac 3d');
  });
});

describe('flopMissedMode 記録入力', () => {
  it('flopRbMissedInput: training_type / scenario_type / metadata', () => {
    const inp = flopRbMissedInput('srp_non_blind', rbQuestion(), 0);
    expect(inp.training_type).toBe('srp_non_blind');
    expect(inp.scenario_type).toBe('flop_cb');
    expect(inp.hero_position).toBe('CO');
    expect(inp.opener_position).toBe('BTN');
    const meta = JSON.parse(inp.metadata!);
    expect(meta).toMatchObject({ board: 'AdAc3d', variant: 'cor_btnc', pot: 'SRP', kind: 'cb' });
  });

  it('flopBeginnerMissedInput: training_type=flop_beginner / metadata', () => {
    const inp = flopBeginnerMissedInput(beginnerQuestion(), 0);
    expect(inp.training_type).toBe('flop_beginner');
    expect(inp.scenario_type).toBe('flop_beginner');
    const meta = JSON.parse(inp.metadata!);
    expect(meta).toMatchObject({ board: '8h8d8c', variant: 'v1', pot: 'SRP', kind: 'cb' });
  });
});

describe('flopMissedLabel', () => {
  it('「{ボード} {シチュエーション}」形式', () => {
    const row = rowWith({ board: 'AdAc3d', variant: 'v', pot: 'SRP', kind: 'cb' });
    expect(flopMissedLabel(row)).toBe('Ad Ac 3d  srp BTN vs BB');
  });
  it('metadata 壊れていれば hand にフォールバック', () => {
    const row = { ...rowWith({}, { metadata: 'not-json' }) };
    expect(flopMissedLabel(row)).toBe('-');
  });
  it('parseFlopMeta は board/variant/pot を要求', () => {
    expect(parseFlopMeta(rowWith({ board: 'AdAc3d', variant: 'v', pot: 'SRP' }))).toMatchObject({ board: 'AdAc3d' });
    expect(parseFlopMeta(rowWith({ board: 'AdAc3d' }))).toBeNull();
  });
});

describe('再構築 (recordTo*Question)', () => {
  const RB_DATA: FlopRbData = {
    cb_choices: ['check', '33', '50', '75', '125', 'ALLIN'],
    preflop: {},
    cb: {
      SRP: [{ variant: 'cor_btnc', hero: 'CO', villain: 'BTN', pot: 'SRP', board: 'AsKd2c', strat: { check: 0.5, '33': 0.5 } }],
      '3bet': [],
      '4bet5bet': [],
    },
  };
  const BEG_DATA: FlopTrainingData = {
    cb: { SRP: { grp: [{ variant: 'x', hero: 'BTN', villain: 'BB', pot: 'SRP', board: '8h8d8c', rate: 0.9, actions: [] }] }, '3bet': {} },
    donk: {},
    cb_threshold: 0.7,
    donk_threshold: 0.6,
    preflop: {},
  };

  it('range: variant+board から FlopRbQuestion を組む', () => {
    const q = recordToFlopRbQuestion(RB_DATA, 'cor_btnc', 'AsKd2c');
    expect(q).not.toBeNull();
    expect(q!.hero).toBe('CO');
    expect(q!.villain).toBe('BTN');
    expect(q!.pot).toBe('SRP');
    expect(q!.kind).toBe('cb');
    expect(q!.board.map((c) => `${c.rank}${c.suit}`).join('')).toBe('AsKd2c');
  });

  it('range: 見つからなければ null', () => {
    expect(recordToFlopRbQuestion(RB_DATA, 'nope', 'AsKd2c')).toBeNull();
  });

  it('beginner: variant+board から FlopQuestion を組む (correct を再計算)', () => {
    const q = recordToFlopBeginnerQuestion(BEG_DATA, 'x', '8h8d8c');
    expect(q).not.toBeNull();
    expect(q!.type).toBe('cb');
    expect(q!.correct).toBe('bet'); // rate 0.9 >= threshold 0.7
  });
});
