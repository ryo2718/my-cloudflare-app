// @vitest-environment jsdom
// フロップ中級CB プレイ画面: ロード後にシナリオ・進捗が描画される (スモーク)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../test/ui';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import type { FlopCbQuestion } from '../../data/training/flopIntermediateCb';
import { saveInstantFeedback } from '../../data/userPreferences';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ account: null, sessionId: null }) }));
vi.mock('../../data/training/flopCbRecordsStore', () => ({
  saveFlopCbRecords: vi.fn(),
  clearFlopCbRecords: vi.fn(),
  loadFlopCbRecords: vi.fn(),
}));
vi.mock('../../data/training/flopIntermediateCb', async (orig) => ({
  ...(await orig<typeof import('../../data/training/flopIntermediateCb')>()),
  generateFlopCbQuestions: vi.fn(),
}));

import { generateFlopCbQuestions } from '../../data/training/flopIntermediateCb';
import { TrainingPlayFlopIntermediate } from './TrainingPlayFlopIntermediate';

const LEVEL = TRAINING_CATALOG[1].levels[1]; // flop_intermediate (中級CB)

function makeQ(): FlopCbQuestion {
  return {
    id: 1,
    potCat: 'SRP',
    pot: 'SRP',
    variant: 'cor_btnc',
    hero: 'CO',
    villain: 'BTN',
    board: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' }],
    choices: ['check', '33', '50', '75', '125'],
    strat: { check: 0.4, '33': 0.4, '50': 0.2 },
    preflopActions: [],
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response));
  vi.mocked(generateFlopCbQuestions).mockResolvedValue([makeQ(), makeQ()]);
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayFlopIntermediate', () => {
  it('ロード後にシナリオラベルと進捗を表示する', async () => {
    render(<TrainingPlayFlopIntermediate level={LEVEL} />);
    expect(await screen.findByText('srp CO vs BTN')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('中級CB')).toBeTruthy();
  });
});
