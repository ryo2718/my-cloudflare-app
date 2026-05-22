// @vitest-environment jsdom
// フェーズ4: 初級プレイ画面 — 2択ボタン形式の描画と回答→次問フロー。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import type { PreflopQuestion } from '../../data/training/preflopBeginner';
import type { TrainingLevel } from '../../data/trainingCatalog';
import { saveInstantFeedback } from '../../data/userPreferences';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ sessionId: null }) }));
vi.mock('../../data/training/actionHistory', async (orig) => ({
  ...(await orig<typeof import('../../data/training/actionHistory')>()),
  loadActionHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../data/training/preflopBeginner', async (orig) => ({
  ...(await orig<typeof import('../../data/training/preflopBeginner')>()),
  generatePreflopQuestions: vi.fn(),
}));

import { generatePreflopQuestions } from '../../data/training/preflopBeginner';
import { TrainingPlay } from './TrainingPlay';

const LEVEL: TrainingLevel = {
  key: 'preflop_beginner',
  label: '初級',
  points: 1,
  questionCount: 20,
  timeLimitSec: 'none',
  implemented: true,
};

function makeQ(): PreflopQuestion {
  return {
    scenario: 'open',
    myPosition: 'UTG',
    opener: null,
    foldedBefore: [],
    hand: 'AA',
    cards: [{ rank: 'A', suit: 's' }, { rank: 'A', suit: 'h' }],
    correct: 'participate',
    strategy: { allin: 0, raise: 100, call: 0, fold: 0 },
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hands: {} }) }) as unknown as Response));
  vi.mocked(generatePreflopQuestions).mockResolvedValue([makeQ(), makeQ()]);
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlay (初級) 2択ボタン', () => {
  it('「参加」「参加しない」が描画され、回答すると次問へ進む', async () => {
    const user = userEvent.setup();
    render(<TrainingPlay level={LEVEL} />);

    expect(await screen.findByRole('button', { name: '参加' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '参加しない' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '参加' }));
    // 2問用意 → 次問の回答UIが出る
    expect(await screen.findByRole('button', { name: '参加' })).toBeTruthy();
  });
});
