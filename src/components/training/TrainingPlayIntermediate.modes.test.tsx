// @vitest-environment jsdom
// フェーズ4: 中級総合プレイ画面 — 複数選択形式の描画と回答→次問フロー。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import type { IntermediateQuestion } from '../../data/training/preflopIntermediate';
import type { TrainingLevel } from '../../data/trainingCatalog';
import { saveInstantFeedback } from '../../data/userPreferences';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ sessionId: null }) }));
vi.mock('../../data/training/actionHistory', async (orig) => ({
  ...(await orig<typeof import('../../data/training/actionHistory')>()),
  loadActionHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../data/training/preflopIntermediate', async (orig) => ({
  ...(await orig<typeof import('../../data/training/preflopIntermediate')>()),
  generateIntermediateQuestions: vi.fn(),
}));

import { generateIntermediateQuestions } from '../../data/training/preflopIntermediate';
import { TrainingPlayIntermediate } from './TrainingPlayIntermediate';

const LEVEL: TrainingLevel = {
  key: 'preflop_intermediate',
  label: '中級 総合',
  points: 2,
  questionCount: 20,
  timeLimitSec: 20,
  implemented: true,
};

function makeQ(): IntermediateQuestion {
  return {
    scenarioType: 'bb_response',
    myPosition: 'BB',
    opener: 'CO',
    foldedBefore: [],
    chipExtras: [],
    hand: 'AA',
    cards: [{ rank: 'A', suit: 's' }, { rank: 'A', suit: 'h' }],
    strategy: { allin: 0, raise: 80, call: 0, fold: 20 },
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hands: {} }) }) as unknown as Response));
  vi.mocked(generateIntermediateQuestions).mockResolvedValue([makeQ(), makeQ()]);
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayIntermediate 複数選択形式', () => {
  it('複数選択UI (回答する) が描画され、回答すると次問へ進む', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayIntermediate level={LEVEL} />);

    const submit = await screen.findByRole('button', { name: '回答する' });
    expect(submit).toBeTruthy();
    await user.click(submit);
    // 2問用意 → 次問の回答UIが出る
    expect(await screen.findByRole('button', { name: '回答する' })).toBeTruthy();
  });
});
