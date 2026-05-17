import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainingResult } from './TrainingResult';
import { AuthContext, type AuthState } from '../../contexts/AuthContext';
import {
  clearRecords,
  saveRecords,
  type ProblemRecord,
} from '../../data/training/recordsStore';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';

const BEGINNER = TRAINING_CATALOG[0].levels[0];

function fakeAuth(): AuthState {
  return {
    status: 'authenticated',
    account: { id: 1, poker_name: 'テスト君', is_admin: false },
    sessionId: 'sid',
    login: async () => {},
    signup: async () => {},
    logout: async () => {},
  };
}

function record(
  id: number,
  scenario: 'open' | 'vs_open',
  opts: {
    myPosition?: 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
    opener?: 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | null;
    correct?: 'participate' | 'fold';
    userAnswer?: 'participate' | 'fold';
    hand?: string;
  } = {},
): ProblemRecord {
  const myPosition = opts.myPosition ?? (scenario === 'open' ? 'UTG' : 'SB');
  const opener = opts.opener ?? (scenario === 'vs_open' ? 'BTN' : null);
  const correct = opts.correct ?? 'participate';
  const userAnswer = opts.userAnswer ?? 'fold';
  const hand = opts.hand ?? 'QJo';
  return {
    id,
    scenario,
    myPosition,
    opener,
    foldedBefore: [],
    hand: hand as ProblemRecord['hand'],
    cards: [
      { rank: hand[0], suit: 'h' },
      { rank: hand[1] ?? hand[0], suit: 's' },
    ],
    correct,
    userAnswer,
    isCorrect: userAnswer === correct,
  };
}

function render(): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={fakeAuth()}>
      <TrainingResult level={BEGINNER} />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('window', {
    location: { search: '?score=15&total=20', pathname: '/training/preflop-beginner/result' },
    history: { pushState: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as Window);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearRecords(BEGINNER.key);
});

describe('<TrainingResult /> 間違えた問題セクション', () => {
  it('全問正解 (missed=0) → "間違えた問題" セクション非表示', () => {
    saveRecords(BEGINNER.key, [
      record(1, 'open', { userAnswer: 'participate', correct: 'participate' }),
      record(2, 'open', { userAnswer: 'fold', correct: 'fold' }),
    ]);
    const html = render();
    expect(html).not.toContain('間違えた問題');
  });

  it('missed 1 件 → "間違えた問題 (1問)" 見出し表示', () => {
    saveRecords(BEGINNER.key, [
      record(1, 'open', { userAnswer: 'fold', correct: 'participate' }),
    ]);
    const html = render();
    expect(html).toContain('間違えた問題 (1問)');
  });

  it('missed 3 件 → カード 3 枚 + 件数 3', () => {
    saveRecords(BEGINNER.key, [
      record(1, 'open', { userAnswer: 'fold', correct: 'participate' }),
      record(2, 'open', { userAnswer: 'participate', correct: 'fold' }),
      record(3, 'vs_open', { userAnswer: 'fold', correct: 'participate' }),
    ]);
    const html = render();
    expect(html).toContain('間違えた問題 (3問)');
    // 各カード末尾の「問題へ」ボタン
    const reviewBtnCount = (html.match(/問題へ/g) ?? []).length;
    expect(reviewBtnCount).toBe(3);
  });

  it('open シナリオラベル: "UTG オープン判定"', () => {
    saveRecords(BEGINNER.key, [
      record(1, 'open', { myPosition: 'UTG', userAnswer: 'fold', correct: 'participate' }),
    ]);
    const html = render();
    expect(html).toContain('UTG オープン判定');
  });

  it('vs_open シナリオラベル: "vs BTN open"', () => {
    saveRecords(BEGINNER.key, [
      record(1, 'vs_open', { opener: 'BTN', userAnswer: 'fold', correct: 'participate' }),
    ]);
    const html = render();
    expect(html).toContain('vs BTN open');
  });

  it('「あなた」と「正解」両方の解答を表示', () => {
    saveRecords(BEGINNER.key, [
      record(1, 'open', { userAnswer: 'fold', correct: 'participate' }),
    ]);
    const html = render();
    expect(html).toContain('あなた');
    expect(html).toContain('正解');
  });
});
