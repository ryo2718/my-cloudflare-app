// @vitest-environment jsdom
// フェーズ2: 挑戦モードの即時フィードバック (トグルON/OFF)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import type { MissedProblemRow } from '../../api/missedProblems';
import type { PreflopQuestion } from '../../data/training/preflopBeginner';
import { saveInstantFeedback } from '../../data/userPreferences';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ sessionId: 'sid' }) }));
vi.mock('../../data/training/actionHistory', async (orig) => ({
  ...(await orig<typeof import('../../data/training/actionHistory')>()),
  loadActionHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../api/missedProblems', async (orig) => ({
  ...(await orig<typeof import('../../api/missedProblems')>()),
  apiGetMissedProblems: vi.fn(),
}));
vi.mock('../../data/training/reviewMode', async (orig) => ({
  ...(await orig<typeof import('../../data/training/reviewMode')>()),
  recordToBeginnerQuestion: vi.fn(),
}));

import { apiGetMissedProblems } from '../../api/missedProblems';
import { recordToBeginnerQuestion } from '../../data/training/reviewMode';
import { MissedChallengePlayPage } from './MissedChallengePlayPage';

const HANDS = { AA: { allin: 0, raise: 100, call: 0, check: 0, fold: 0 } };

const Q: PreflopQuestion = {
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
  strategy: { allin: 0, raise: 100, call: 0, fold: 0 },
};

function row(id: number): MissedProblemRow {
  return {
    id,
    account_id: 1,
    training_type: 'preflop_beginner',
    scenario_type: 'beginner_open',
    hero_position: 'UTG',
    opener_position: null,
    three_bettor_position: null,
    hand: 'AA',
    user_selections: '["fold"]',
    gto_strategy: '{"allin":0,"raise":100,"call":0,"fold":0}',
    score_obtained: -1,
    is_timeout: 0,
    is_removed_from_review: 0,
    created_at: 0,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hands: HANDS }) }) as unknown as Response));
  vi.mocked(apiGetMissedProblems).mockResolvedValue([row(1), row(2)]);
  vi.mocked(recordToBeginnerQuestion).mockReturnValue(Q);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MissedChallengePlayPage 即時フィードバック (UI)', () => {
  it('トグルON: 回答後に判定/pt/レンジ/「次のハンドへ」が出る', async () => {
    saveInstantFeedback(true);
    const user = userEvent.setup();
    render(<MissedChallengePlayPage level="beginner" count={5} filter="all" />);

    await user.click(await screen.findByRole('button', { name: '参加' }));

    expect(await screen.findByText('次のハンドへ')).toBeTruthy();
    expect(screen.getByText('○')).toBeTruthy(); // 正解 (participate) → final_score 1
    expect(screen.getByText('+1pt')).toBeTruthy();
    expect(screen.getAllByText('レイズ').length).toBeGreaterThan(0); // 頻度バー
    expect(screen.queryByRole('button', { name: '参加' })).toBeNull(); // 回答UIは隠れる
  });

  it('トグルOFF: 回答後フィードバックを出さず次問へ', async () => {
    saveInstantFeedback(false);
    const user = userEvent.setup();
    render(<MissedChallengePlayPage level="beginner" count={5} filter="all" />);

    await user.click(await screen.findByRole('button', { name: '参加' }));
    // 次問 (2問用意) の回答UIが出て、フィードバックは無い
    expect(await screen.findByRole('button', { name: '参加' })).toBeTruthy();
    expect(screen.queryByText('次のハンドへ')).toBeNull();
  });
});
