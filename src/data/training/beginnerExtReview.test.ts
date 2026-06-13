import { describe, it, expect } from 'vitest';
import {
  classifyExtRow,
  extNodeFile,
  extScenarioLabel,
  recordToOpenReview,
  recordToSelectReview,
} from './beginnerExtReview';
import type { MissedProblemRow } from '../../api/missedProblems';

function row(over: Partial<MissedProblemRow>): MissedProblemRow {
  return {
    id: 1,
    account_id: 1,
    training_type: 'preflop_beginner_open',
    scenario_type: 'beginner_open',
    hero_position: 'HJ',
    opener_position: null,
    three_bettor_position: null,
    hand: 'A5s',
    user_selections: '[]',
    gto_strategy: '{"allin":0,"raise":80,"call":0,"fold":20}',
    score_obtained: -1,
    is_timeout: 0,
    is_removed_from_review: 0,
    created_at: 0,
    ...over,
  };
}

describe('classifyExtRow', () => {
  it('open / select / null を判定', () => {
    expect(classifyExtRow(row({ training_type: 'preflop_beginner_open' }))).toBe('open');
    expect(classifyExtRow(row({ training_type: 'preflop_beginner_vs_open' }))).toBe('select');
    expect(classifyExtRow(row({ training_type: 'preflop_beginner_vs_3bet_4bet' }))).toBe('select');
    expect(classifyExtRow(row({ training_type: 'preflop_beginner' }))).toBeNull();
    expect(classifyExtRow(row({ training_type: 'preflop_intermediate' }))).toBeNull();
  });
});

describe('extNodeFile (scenario + positions → node)', () => {
  it('open = {hero}.json', () => {
    expect(extNodeFile(row({ scenario_type: 'beginner_open', hero_position: 'HJ' }))).toBe('hj.json');
  });
  it('vs_open = {opener}r_{hero}.json', () => {
    expect(extNodeFile(row({ scenario_type: 'beginner_vs_open', opener_position: 'CO', hero_position: 'BB' }))).toBe('cor_bb.json');
  });
  it('vs_3bet = {opener}r_{tb}r_{opener}.json', () => {
    expect(extNodeFile(row({ scenario_type: 'beginner_vs_3bet', opener_position: 'UTG', hero_position: 'UTG', three_bettor_position: 'BB' }))).toBe('utgr_bbr_utg.json');
  });
  it('vs_4bet = {opener}r_{tb}r_{opener}r_{tb}.json', () => {
    expect(extNodeFile(row({ scenario_type: 'beginner_vs_4bet', opener_position: 'UTG', hero_position: 'BB', three_bettor_position: 'BB' }))).toBe('utgr_bbr_utgr_bb.json');
  });
});

describe('extScenarioLabel', () => {
  it('各シナリオのラベル', () => {
    expect(extScenarioLabel(row({ scenario_type: 'beginner_open', hero_position: 'HJ' }))).toBe('HJ オープン');
    expect(extScenarioLabel(row({ scenario_type: 'beginner_vs_open', hero_position: 'BB', opener_position: 'CO' }))).toBe('BB vs CO オープン');
    expect(extScenarioLabel(row({ scenario_type: 'beginner_vs_3bet', hero_position: 'UTG', three_bettor_position: 'BB' }))).toBe('UTG vs BB 3bet');
    expect(extScenarioLabel(row({ scenario_type: 'beginner_vs_4bet', hero_position: 'BB', opener_position: 'UTG' }))).toBe('BB vs UTG 4bet');
  });
});

describe('recordToOpenReview / recordToSelectReview', () => {
  it('open: raisePct を strategy.raise から復元', () => {
    const q = recordToOpenReview(row({ training_type: 'preflop_beginner_open', scenario_type: 'beginner_open', hero_position: 'HJ', gto_strategy: '{"allin":0,"raise":80,"call":0,"fold":20}' }));
    expect(q).not.toBeNull();
    expect(q!.position).toBe('HJ');
    expect(q!.nodeFile).toBe('hj.json');
    expect(q!.raisePct).toBe(80);
    expect(q!.cards).toHaveLength(2);
  });

  it('select: strategy / hero / nodeFile / label を復元', () => {
    const q = recordToSelectReview(row({
      training_type: 'preflop_beginner_vs_open', scenario_type: 'beginner_vs_open',
      hero_position: 'BB', opener_position: 'CO', hand: 'A5s',
      gto_strategy: '{"allin":0,"raise":0,"call":70,"fold":30}',
    }));
    expect(q).not.toBeNull();
    expect(q!.hero).toBe('BB');
    expect(q!.nodeFile).toBe('cor_bb.json');
    expect(q!.strategy.call).toBe(70);
    expect(q!.scenarioLabel).toBe('BB vs CO オープン');
  });

  it('種別違いは null', () => {
    expect(recordToOpenReview(row({ training_type: 'preflop_beginner_vs_open' }))).toBeNull();
    expect(recordToSelectReview(row({ training_type: 'preflop_beginner_open' }))).toBeNull();
  });
});
