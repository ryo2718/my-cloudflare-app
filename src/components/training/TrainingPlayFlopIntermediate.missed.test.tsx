// @vitest-environment jsdom
// 記録経路: フロップ レンジベットで満点未満(不正解)の問題が apiPostMissedProblems に
// 送られること (training_type / metadata 付き)。満点のみ(全問正解)では送られないこと。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import type { FlopRbQuestion } from '../../data/training/flopIntermediateCb';
import { saveInstantFeedback } from '../../data/userPreferences';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ account: { is_admin: true }, sessionId: 'sid' }),
}));
vi.mock('../../data/training/flopCbRecordsStore', () => ({
  saveFlopRbRecords: vi.fn(),
  clearFlopRbRecords: vi.fn(),
  loadFlopRbRecords: vi.fn(),
}));
vi.mock('../../data/training/flopIntermediateCb', async (orig) => ({
  ...(await orig<typeof import('../../data/training/flopIntermediateCb')>()),
  generateFlopRbQuestions: vi.fn(),
}));
vi.mock('../../api/missedProblems', async (orig) => ({
  ...(await orig<typeof import('../../api/missedProblems')>()),
  apiPostMissedProblems: vi.fn().mockResolvedValue({ inserted: 0 }),
}));

import { generateFlopRbQuestions } from '../../data/training/flopIntermediateCb';
import { apiPostMissedProblems } from '../../api/missedProblems';
import { TrainingPlayFlopIntermediate } from './TrainingPlayFlopIntermediate';

const LEVEL = TRAINING_CATALOG[1].levels[1]; // srp_non_blind
const board = (): FlopRbQuestion['board'] => [
  { rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' },
];
const QS: FlopRbQuestion[] = [
  { id: 1, pot: 'SRP', kind: 'cb', variant: 'cor_btnc', hero: 'CO', villain: 'BTN', board: board(),
    choices: ['check', '33', '50', '75', '125'], strat: { check: 0.5, '33': 0.5, '50': 0, '75': 0, '125': 0 }, preflopActions: [], similar: [] },
  { id: 2, pot: '3bet', kind: 'cb', variant: 'utgr_btnr_utgc', hero: 'UTG', villain: 'BTN', board: board(),
    choices: ['check', '33', '50', '75', '125'], strat: { check: 0.2, '33': 0.4, '50': 0.4, '75': 0, '125': 0 }, preflopActions: [], similar: [] },
];

beforeEach(() => {
  vi.mocked(apiPostMissedProblems).mockClear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response));
  vi.mocked(generateFlopRbQuestions).mockResolvedValue(QS.map((q) => ({ ...q })));
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayFlopIntermediate 間違えた問題の記録', () => {
  it('全問不正解で apiPostMissedProblems に srp_non_blind + metadata を送る', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayFlopIntermediate level={LEVEL} />);
    await user.click(await screen.findByRole('button', { name: '全問不正解' }));

    expect(apiPostMissedProblems).toHaveBeenCalledTimes(1);
    const [, records] = vi.mocked(apiPostMissedProblems).mock.calls[0];
    expect(records).toHaveLength(2);
    expect(records[0].training_type).toBe('srp_non_blind');
    expect(records[0].scenario_type).toBe('flop_cb');
    const meta = JSON.parse(records[0].metadata!);
    expect(meta).toMatchObject({ board: 'AsKd2c', variant: 'cor_btnc', pot: 'SRP', kind: 'cb' });
  });

  it('全問正解(満点)では記録を送らない', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayFlopIntermediate level={LEVEL} />);
    await user.click(await screen.findByRole('button', { name: '全問正解' }));
    expect(apiPostMissedProblems).not.toHaveBeenCalled();
  });
});
