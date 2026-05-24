// フロップ記録ストア: 保存→読み出し→クリアの往復。

import { describe, it, expect, beforeEach } from 'vitest';
import { saveFlopRecords, loadFlopRecords, clearFlopRecords } from './flopRecordsStore';
import type { FlopRecord } from './flopBeginner';

const REC = (recordId: number, isCorrect: boolean): FlopRecord => ({
  id: recordId,
  recordId,
  type: 'cb',
  pot: 'SRP',
  variant: 'btnr_bbc',
  hero: 'BTN',
  villain: 'BB',
  board: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' }],
  rate: 0.9,
  threshold: 0.7,
  correct: 'bet',
  actions: [{ code: 'R2', freq: 0.9, bp: 0.33 }],
  preflopActions: [],
  choice: isCorrect ? 'bet' : 'check',
  isCorrect,
});

beforeEach(() => {
  clearFlopRecords('flop_beginner');
});

describe('flopRecordsStore', () => {
  it('保存した記録をそのまま読み出せる', () => {
    const records = [REC(1, true), REC(2, false)];
    saveFlopRecords('flop_beginner', records);
    const loaded = loadFlopRecords('flop_beginner');
    expect(loaded).toHaveLength(2);
    expect(loaded?.map((r) => r.isCorrect)).toEqual([true, false]);
  });

  it('未保存なら null', () => {
    expect(loadFlopRecords('flop_beginner')).toBeNull();
  });

  it('clear で消える', () => {
    saveFlopRecords('flop_beginner', [REC(1, true)]);
    clearFlopRecords('flop_beginner');
    expect(loadFlopRecords('flop_beginner')).toBeNull();
  });
});
