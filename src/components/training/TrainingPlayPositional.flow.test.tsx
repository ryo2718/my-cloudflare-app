// @vitest-environment jsdom
// フェーズ3: 出題フロー (回答 → 採点 → 最終問題後に完了画面へ遷移)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '../../test/ui';
import type { PositionalQuestion } from '../../data/training/preflopIntermediatePositional';
import type { TrainingLevel } from '../../data/trainingCatalog';
import { saveInstantFeedback } from '../../data/userPreferences';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ sessionId: null }) }));
vi.mock('../../data/training/actionHistory', async (orig) => ({
  ...(await orig<typeof import('../../data/training/actionHistory')>()),
  loadActionHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../data/training/preflopIntermediatePositional', async (orig) => {
  const actual = await orig<typeof import('../../data/training/preflopIntermediatePositional')>();
  return { ...actual, generatePositionalQuestions: vi.fn(), scorePositionalPoints: vi.fn(() => 2) };
});

import { generatePositionalQuestions } from '../../data/training/preflopIntermediatePositional';
import { navigate } from '../../router/router-core';
import { TrainingPlayPositional } from './TrainingPlayPositional';

const LABELS = { allin: 'オールイン', raise: 'レイズ', call: 'コール', check: 'チェック', fold: 'フォールド' };
const LEVEL: TrainingLevel = {
  key: 'preflop_intermediate_ep',
  label: '中級 EP',
  points: 1,
  questionCount: 20,
  timeLimitSec: 'none',
  implemented: true,
};

const Q: PositionalQuestion = {
  mode: 'ep', scenarioKey: 'ep_open', label: 'UTG オープン', format: 'select',
  myPosition: 'UTG', opener: null, foldedBefore: [], chipExtras: [],
  hand: 'AA', cards: [{ rank: 'A', suit: 's' }, { rank: 'A', suit: 'h' }],
  strategy: { allin: 0, raise: 100, call: 0, check: 0, fold: 0 },
  sliderAction: 'raise', sliderCorrectPct: 80,
  availableActions: ['allin', 'raise', 'call', 'fold'], actionLabels: LABELS, limpAction: null,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hands: {} }) }) as unknown as Response));
  vi.mocked(generatePositionalQuestions).mockResolvedValue([Q]); // 1問
  vi.mocked(navigate).mockClear();
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayPositional 出題フロー', () => {
  it('最終問題に回答すると結果画面へ遷移する (score/total/mode 付き)', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayPositional level={LEVEL} />);

    // 回答UIが出る (出題完了)
    const submit = await screen.findByRole('button', { name: '回答する' });
    await user.click(submit);

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    const dest = vi.mocked(navigate).mock.calls[0][0] as string;
    expect(dest).toContain('/result');
    expect(dest).toContain('mode=positional');
    expect(dest).toContain('total=20'); // maxScoreForMode('ep')
    expect(dest).toContain('score=1'); // totalPositionalScore([2]) = floor(2/2)
  });
});
