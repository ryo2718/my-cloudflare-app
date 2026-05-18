import { describe, expect, it } from 'vitest';
import { recordToIntermediateQuestion, recordsToQuestions } from './reviewMode';
import type { MissedProblemRow } from '../../api/missedProblems';

function row(over: Partial<MissedProblemRow>): MissedProblemRow {
  return {
    id: 1,
    account_id: 1,
    training_type: 'preflop_intermediate',
    scenario_type: 'bb_response',
    hero_position: 'BB',
    opener_position: 'UTG',
    three_bettor_position: null,
    hand: 'QJs',
    user_selections: JSON.stringify(['call', 'fold']),
    gto_strategy: JSON.stringify({ allin: 0, raise: 0, call: 24, fold: 76 }),
    score_obtained: 1,
    is_timeout: 0,
    is_removed_from_review: 0,
    created_at: Date.now(),
    ...over,
  };
}

describe('recordToIntermediateQuestion (各シナリオの復元)', () => {
  it('bb_response: BB 視点、UTG opener、foldedBefore = UTG 以前 + UTG-BB の間', () => {
    const q = recordToIntermediateQuestion(row({ scenario_type: 'bb_response', hero_position: 'BB', opener_position: 'UTG' }));
    expect(q).not.toBeNull();
    expect(q!.scenarioType).toBe('bb_response');
    expect(q!.myPosition).toBe('BB');
    expect(q!.opener).toBe('UTG');
    expect(q!.chipExtras).toEqual([{ position: 'UTG', amount: 2.5 }]);
    expect(q!.foldedBefore).toEqual(['HJ', 'CO', 'BTN', 'SB']);
  });

  it('vs_3bet: 自分=opener、3bettor のチップが追加される', () => {
    const q = recordToIntermediateQuestion(
      row({ scenario_type: 'vs_3bet', hero_position: 'UTG', opener_position: 'UTG', three_bettor_position: 'BB' }),
    );
    expect(q!.scenarioType).toBe('vs_3bet');
    expect(q!.myPosition).toBe('UTG');
    expect(q!.threeBettor).toBe('BB');
    expect(q!.chipExtras).toContainEqual({ position: 'UTG', amount: 2.5 });
    expect(q!.chipExtras).toContainEqual({ position: 'BB', amount: 12 });
  });

  it('vs_4bet: opener=30, threeBettor=12', () => {
    const q = recordToIntermediateQuestion(
      row({ scenario_type: 'vs_4bet', hero_position: 'BB', opener_position: 'UTG', three_bettor_position: 'BB' }),
    );
    expect(q!.scenarioType).toBe('vs_4bet');
    expect(q!.myPosition).toBe('BB');
    expect(q!.chipExtras).toContainEqual({ position: 'UTG', amount: 30 });
    expect(q!.chipExtras).toContainEqual({ position: 'BB', amount: 12 });
  });

  it('middle_vs_open: BTN/SB 視点、opener にチップ 2.5', () => {
    const q = recordToIntermediateQuestion(
      row({ scenario_type: 'middle_vs_open', hero_position: 'BTN', opener_position: 'UTG' }),
    );
    expect(q!.scenarioType).toBe('middle_vs_open');
    expect(q!.myPosition).toBe('BTN');
    expect(q!.chipExtras).toEqual([{ position: 'UTG', amount: 2.5 }]);
  });

  it('risky_open: 自分=opener、chipExtras 空 (まだ raise してない)', () => {
    const q = recordToIntermediateQuestion(
      row({ scenario_type: 'risky_open', hero_position: 'UTG', opener_position: 'UTG' }),
    );
    expect(q!.scenarioType).toBe('risky_open');
    expect(q!.myPosition).toBe('UTG');
    expect(q!.chipExtras).toEqual([]);
    expect(q!.foldedBefore).toEqual([]);
  });

  it('training_type が preflop_beginner → null (Step 2 では未対応)', () => {
    const q = recordToIntermediateQuestion(row({ training_type: 'preflop_beginner' }));
    expect(q).toBeNull();
  });

  it('不正な scenario_type → null', () => {
    const q = recordToIntermediateQuestion(row({ scenario_type: 'invalid_scenario' }));
    expect(q).toBeNull();
  });

  it('vs_3bet で three_bettor_position が NULL → null (整合性チェック)', () => {
    const q = recordToIntermediateQuestion(
      row({ scenario_type: 'vs_3bet', three_bettor_position: null }),
    );
    expect(q).toBeNull();
  });

  it('GTO 戦略を復元する', () => {
    const q = recordToIntermediateQuestion(
      row({ gto_strategy: JSON.stringify({ allin: 10, raise: 50, call: 20, fold: 20 }) }),
    );
    expect(q!.strategy).toEqual({ allin: 10, raise: 50, call: 20, fold: 20 });
  });

  it('GTO 戦略が壊れた JSON → ゼロ戦略フォールバック', () => {
    const q = recordToIntermediateQuestion(row({ gto_strategy: 'not-json' }));
    expect(q!.strategy).toEqual({ allin: 0, raise: 0, call: 0, fold: 0 });
  });
});

describe('recordsToQuestions (batch)', () => {
  it('有効な row のみ抽出、不正は除外', () => {
    const rows = [
      row({ id: 1, scenario_type: 'bb_response' }),
      row({ id: 2, training_type: 'preflop_beginner' }),   // 除外
      row({ id: 3, scenario_type: 'invalid' }),            // 除外
      row({ id: 4, scenario_type: 'middle_vs_open', hero_position: 'BTN' }),
    ];
    const out = recordsToQuestions(rows);
    expect(out).toHaveLength(2);
  });
});
