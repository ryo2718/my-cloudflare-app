// @vitest-environment jsdom
// フロップ中級レンジベット プレイ画面: ロード後にシナリオ・種別・進捗が描画される (スモーク)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../test/ui';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import type { FlopRbQuestion } from '../../data/training/flopIntermediateCb';
import { saveInstantFeedback } from '../../data/userPreferences';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ account: null, sessionId: null }) }));
vi.mock('../../data/training/flopCbRecordsStore', () => ({
  saveFlopRbRecords: vi.fn(),
  clearFlopRbRecords: vi.fn(),
  loadFlopRbRecords: vi.fn(),
}));
vi.mock('../../data/training/flopIntermediateCb', async (orig) => ({
  ...(await orig<typeof import('../../data/training/flopIntermediateCb')>()),
  generateFlopRbQuestions: vi.fn(),
}));

import { generateFlopRbQuestions } from '../../data/training/flopIntermediateCb';
import { TrainingPlayFlopIntermediate } from './TrainingPlayFlopIntermediate';

const LEVEL = TRAINING_CATALOG[1].levels[1]; // flop_cb_srp (CB SRP)

function cbQ(): FlopRbQuestion {
  return {
    id: 1, pot: 'SRP', kind: 'cb', variant: 'cor_btnc', hero: 'CO', villain: 'BTN',
    board: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' }],
    choices: ['check', '33', '50', '75', '125'], strat: { check: 0.4, '33': 0.4, '50': 0.2 }, preflopActions: [], similar: [],
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response));
  vi.mocked(generateFlopRbQuestions).mockResolvedValue([cbQ(), cbQ()]);
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayFlopIntermediate', () => {
  it('ロード後にシナリオ・種別・進捗を表示する', async () => {
    render(<TrainingPlayFlopIntermediate level={LEVEL} />);
    expect(await screen.findByText('srp CO vs BTN')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('レンジCB SRP')).toBeTruthy();
  });
});
