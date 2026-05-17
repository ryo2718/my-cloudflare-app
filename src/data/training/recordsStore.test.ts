import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRecords,
  loadRecords,
  missedRecords,
  saveRecords,
  type ProblemRecord,
} from './recordsStore';

function fakeRecord(id: number, isCorrect: boolean): ProblemRecord {
  return {
    id,
    scenario: 'open',
    myPosition: 'UTG',
    opener: null,
    foldedBefore: [],
    hand: 'AA',
    cards: [
      { rank: 'A', suit: 's' },
      { rank: 'A', suit: 'h' },
    ],
    correct: 'participate',
    userAnswer: isCorrect ? 'participate' : 'fold',
    isCorrect,
  };
}

afterEach(() => {
  // 各テストで使ったキーを破棄して他テストに影響しないように
  clearRecords('preflop_beginner');
  clearRecords('preflop_intermediate');
});

describe('recordsStore (in-memory + sessionStorage fallback)', () => {
  it('save → load: 同じ配列を取得できる', () => {
    const records = [fakeRecord(1, true), fakeRecord(2, false)];
    saveRecords('preflop_beginner', records);
    expect(loadRecords('preflop_beginner')).toEqual(records);
  });

  it('未保存の key は null', () => {
    expect(loadRecords('not_saved_yet')).toBeNull();
  });

  it('clearRecords で削除できる', () => {
    saveRecords('preflop_beginner', [fakeRecord(1, true)]);
    clearRecords('preflop_beginner');
    expect(loadRecords('preflop_beginner')).toBeNull();
  });

  it('levelKey 単位で独立 (混線しない)', () => {
    saveRecords('preflop_beginner', [fakeRecord(1, true)]);
    saveRecords('preflop_intermediate', [fakeRecord(99, false)]);
    const a = loadRecords('preflop_beginner')!;
    const b = loadRecords('preflop_intermediate')!;
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].id).toBe(1);
    expect(b[0].id).toBe(99);
  });

  it('save は配列を別途コピーする (元配列の mutation で record が壊れない)', () => {
    const orig: ProblemRecord[] = [fakeRecord(1, true)];
    saveRecords('preflop_beginner', orig);
    orig.push(fakeRecord(2, false));
    const loaded = loadRecords('preflop_beginner')!;
    expect(loaded).toHaveLength(1);
  });
});

describe('missedRecords', () => {
  it('isCorrect=false のみ抽出', () => {
    const records = [
      fakeRecord(1, true),
      fakeRecord(2, false),
      fakeRecord(3, true),
      fakeRecord(4, false),
    ];
    const missed = missedRecords(records);
    expect(missed).toHaveLength(2);
    expect(missed.map((r) => r.id)).toEqual([2, 4]);
  });
  it('全問正解 → 空配列', () => {
    const records = [fakeRecord(1, true), fakeRecord(2, true)];
    expect(missedRecords(records)).toEqual([]);
  });
  it('全問不正解 → 全件', () => {
    const records = [fakeRecord(1, false), fakeRecord(2, false)];
    expect(missedRecords(records)).toHaveLength(2);
  });
});
