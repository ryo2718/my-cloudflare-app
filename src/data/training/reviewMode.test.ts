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

// ---------------------------------------------------------------------------
// 初級復習 (Step 3a)
// ---------------------------------------------------------------------------

import { recordToBeginnerQuestion, recordsToBeginnerQuestions } from './reviewMode';

describe('recordToBeginnerQuestion (初級復習用)', () => {
  it('beginner_open: scenario=open, opener=null, correct=participate (raise>fold)', () => {
    const q = recordToBeginnerQuestion(row({
      training_type: 'preflop_beginner',
      scenario_type: 'beginner_open',
      hero_position: 'HJ',
      opener_position: null,
      gto_strategy: JSON.stringify({ allin: 0, raise: 100, call: 0, fold: 0 }),
      hand: 'AKs',
    }));
    expect(q).not.toBeNull();
    expect(q!.scenario).toBe('open');
    expect(q!.opener).toBeNull();
    expect(q!.myPosition).toBe('HJ');
    expect(q!.correct).toBe('participate');
    expect(q!.foldedBefore).toEqual(['UTG']);
  });

  it('beginner_open: fold 100% → correct=fold', () => {
    const q = recordToBeginnerQuestion(row({
      training_type: 'preflop_beginner',
      scenario_type: 'beginner_open',
      hero_position: 'UTG',
      opener_position: null,
      gto_strategy: JSON.stringify({ allin: 0, raise: 0, call: 0, fold: 100 }),
      hand: '72o',
    }));
    expect(q!.correct).toBe('fold');
    expect(q!.foldedBefore).toEqual([]);
  });

  it('beginner_vs_open: scenario=vs_open, opener 復元、foldedBefore は前 + 間', () => {
    const q = recordToBeginnerQuestion(row({
      training_type: 'preflop_beginner',
      scenario_type: 'beginner_vs_open',
      hero_position: 'BB',
      opener_position: 'HJ',
      gto_strategy: JSON.stringify({ allin: 0, raise: 100, call: 0, fold: 0 }),
      hand: 'AKs',
    }));
    expect(q!.scenario).toBe('vs_open');
    expect(q!.opener).toBe('HJ');
    expect(q!.foldedBefore).toEqual(['UTG', 'CO', 'BTN', 'SB']);
  });

  it('preflop_intermediate → null (誤った training_type)', () => {
    const q = recordToBeginnerQuestion(row({
      training_type: 'preflop_intermediate',
      scenario_type: 'beginner_open',
    }));
    expect(q).toBeNull();
  });

  it('beginner_vs_open で opener=null → null (整合性チェック)', () => {
    const q = recordToBeginnerQuestion(row({
      training_type: 'preflop_beginner',
      scenario_type: 'beginner_vs_open',
      opener_position: null,
    }));
    expect(q).toBeNull();
  });
});

describe('recordsToBeginnerQuestions (batch)', () => {
  it('有効な row のみ抽出', () => {
    const rows = [
      row({ id: 1, training_type: 'preflop_beginner', scenario_type: 'beginner_open', opener_position: null }),
      row({ id: 2, training_type: 'preflop_intermediate' }),  // 除外
      row({ id: 3, training_type: 'preflop_beginner', scenario_type: 'beginner_vs_open', opener_position: 'HJ', hero_position: 'BB' }),
      row({ id: 4, training_type: 'preflop_beginner', scenario_type: 'invalid' }),  // 除外
    ];
    const out = recordsToBeginnerQuestions(rows);
    expect(out).toHaveLength(2);
  });
});
