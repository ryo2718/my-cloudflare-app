import { describe, it, expect } from 'vitest';
import {
  recordToPositionalQuestion,
  decodeAnswer,
  encodeMissedInput,
  isPositionalRow,
  modeFromTrainingType,
  SLIDER_SENTINEL,
  SKIP_SENTINEL,
} from './positionalReview';
import type { MissedProblemRow } from '../../api/missedProblems';

function row(over: Partial<MissedProblemRow>): MissedProblemRow {
  return {
    id: 1,
    account_id: 1,
    training_type: 'preflop_intermediate_ep',
    scenario_type: 'ep_open',
    hero_position: 'UTG',
    opener_position: null,
    three_bettor_position: null,
    hand: 'A2s',
    user_selections: JSON.stringify([SLIDER_SENTINEL, '10']),
    gto_strategy: JSON.stringify({ allin: 0, raise: 13, call: 0, check: 0, fold: 87 }),
    score_obtained: 1,
    is_timeout: 0,
    is_removed_from_review: 0,
    created_at: Date.now(),
    ...over,
  };
}

describe('modeFromTrainingType / isPositionalRow', () => {
  it('ポジション別の training_type を判定', () => {
    expect(modeFromTrainingType('preflop_intermediate_ep')).toBe('ep');
    expect(modeFromTrainingType('preflop_intermediate_blind')).toBe('blind');
    expect(modeFromTrainingType('preflop_intermediate')).toBeNull();
    expect(isPositionalRow(row({}))).toBe(true);
    expect(isPositionalRow(row({ training_type: 'preflop_intermediate' }))).toBe(false);
  });
});

describe('recordToPositionalQuestion', () => {
  it('ep_open: スライダー形式、limpなし、正解=raise%', () => {
    const q = recordToPositionalQuestion(row({}));
    expect(q).not.toBeNull();
    expect(q!.format).toBe('slider');
    expect(q!.limpAction).toBeNull();
    expect(q!.sliderCorrectPct).toBe(13);
    expect(q!.label).toContain('UTG');
  });

  it('bb_vs_limp: 複数選択、limp=check、available は check 込み (strategy 由来)', () => {
    const q = recordToPositionalQuestion(
      row({
        training_type: 'preflop_intermediate_blind',
        scenario_type: 'bb_vs_limp',
        hero_position: 'BB',
        gto_strategy: JSON.stringify({ allin: 0, raise: 20, call: 0, check: 80, fold: 0 }),
        user_selections: JSON.stringify(['raise']),
      }),
    );
    expect(q!.format).toBe('select');
    expect(q!.limpAction).toBe('check');
    expect(q!.availableActions).toContain('check');
    expect(q!.actionLabels.check).toBe('チェック');
  });

  it('EP vs3bet は復元時も 4 択固定', () => {
    const q = recordToPositionalQuestion(
      row({
        training_type: 'preflop_intermediate_ep',
        scenario_type: 'ep_vs_3bet',
        hero_position: 'HJ',
        opener_position: 'HJ',
        three_bettor_position: 'BTN',
        gto_strategy: JSON.stringify({ allin: 0, raise: 0, call: 40, check: 0, fold: 60 }),
        user_selections: JSON.stringify(['call']),
      }),
    );
    expect(q!.format).toBe('select');
    expect([...q!.availableActions]).toEqual(['allin', 'raise', 'call', 'fold']);
  });

  it('EP vs4bet (相手オールイン/vs 5bet) は復元時 call/fold 2択', () => {
    const q = recordToPositionalQuestion(
      row({
        training_type: 'preflop_intermediate_ep',
        scenario_type: 'ep_vs_4bet',
        hero_position: 'HJ',
        opener_position: 'HJ',
        three_bettor_position: 'BTN',
        gto_strategy: JSON.stringify({ allin: 0, raise: 0, call: 100, check: 0, fold: 0 }),
        user_selections: JSON.stringify(['call']),
      }),
    );
    expect([...q!.availableActions]).toEqual(['call', 'fold']);
  });

  it('非ポジション (中級総合) は null', () => {
    expect(recordToPositionalQuestion(row({ training_type: 'preflop_intermediate' }))).toBeNull();
  });
});

describe('decodeAnswer', () => {
  it('スライダー回答を復元', () => {
    expect(decodeAnswer(row({}))).toEqual({ response: { kind: 'slider', pct: 10 }, sliderPct: 10 });
  });
  it('飛ばし', () => {
    expect(decodeAnswer(row({ user_selections: JSON.stringify([SKIP_SENTINEL]) })).response).toEqual({ kind: 'skip' });
  });
  it('時間切れ', () => {
    expect(decodeAnswer(row({ is_timeout: 1 })).response).toEqual({ kind: 'timeout' });
  });
  it('複数選択', () => {
    expect(
      decodeAnswer(row({ scenario_type: 'sb_open', training_type: 'preflop_intermediate_blind', user_selections: JSON.stringify(['raise', 'call']) })).response,
    ).toEqual({ kind: 'select', selections: ['raise', 'call'] });
  });
});

describe('encodeMissedInput (round-trip)', () => {
  it('スライダー: user_selections に sentinel + %、gto_strategy に check 含む', () => {
    const q = recordToPositionalQuestion(row({}))!;
    const input = encodeMissedInput(q, { kind: 'slider', pct: 10 }, 1);
    expect(input.training_type).toBe('preflop_intermediate_ep');
    expect(input.scenario_type).toBe('ep_open');
    expect(input.user_selections).toEqual([SLIDER_SENTINEL, '10']);
    expect(input.gto_strategy).toHaveProperty('check');
    expect(input.score_obtained).toBe(1);
  });
  it('複数選択 + 時間切れ', () => {
    const q = recordToPositionalQuestion(
      row({ training_type: 'preflop_intermediate_blind', scenario_type: 'sb_open', hero_position: 'SB' }),
    )!;
    expect(encodeMissedInput(q, { kind: 'select', selections: ['raise'] }, 0).user_selections).toEqual(['raise']);
    const t = encodeMissedInput(q, { kind: 'timeout' }, -1);
    expect(t.is_timeout).toBe(true);
    expect(t.user_selections).toEqual([]);
  });
});
