// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveAnswerReview,
  loadAnswerReview,
  clearAnswerReview,
  type AnswerReviewRecord,
} from './answerReviewStore';

const recs: AnswerReviewRecord[] = [
  { id: 1, scenario: 'HJ オープン', hand: 'A5s', nodeFile: 'hj.json', mePosition: 'HJ', correct: true, userText: '50%', correctText: '50%' },
  { id: 2, scenario: 'CO オープン → BB', hand: 'K9o', nodeFile: 'cor_bb.json', mePosition: 'BB', correct: false, userText: 'レイズ', correctText: 'コール100' },
];

beforeEach(() => {
  sessionStorage.clear();
  clearAnswerReview('lvl_a');
  clearAnswerReview('lvl_b');
});

describe('answerReviewStore (汎用・level.key キー)', () => {
  it('save → load で往復する', () => {
    saveAnswerReview('lvl_a', recs);
    expect(loadAnswerReview('lvl_a')).toEqual(recs);
  });

  it('level.key ごとに分離される', () => {
    saveAnswerReview('lvl_a', recs);
    expect(loadAnswerReview('lvl_b')).toBeNull();
  });

  it('clear で消える', () => {
    saveAnswerReview('lvl_a', recs);
    clearAnswerReview('lvl_a');
    expect(loadAnswerReview('lvl_a')).toBeNull();
  });

  it('未保存は null', () => {
    expect(loadAnswerReview('never')).toBeNull();
  });
});
