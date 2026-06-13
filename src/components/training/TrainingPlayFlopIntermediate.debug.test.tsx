// @vitest-environment jsdom
// admin デバッグ (共有 DebugAnswerBar + harness.debugComplete) がレンジベット (全CB) で動くこと。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import type { FlopRbQuestion } from '../../data/training/flopIntermediateCb';
import { saveInstantFeedback } from '../../data/userPreferences';

const hoisted = vi.hoisted(() => ({ admin: true }));

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ account: { is_admin: hoisted.admin }, sessionId: null }),
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

import { navigate } from '../../router/router-core';
import { saveFlopRbRecords } from '../../data/training/flopCbRecordsStore';
import { generateFlopRbQuestions } from '../../data/training/flopIntermediateCb';
import { TrainingPlayFlopIntermediate } from './TrainingPlayFlopIntermediate';

const LEVEL = TRAINING_CATALOG[1].levels[1];
const board = (): FlopRbQuestion['board'] => [
  { rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' },
];

// 全 CB (SRP と 3bet の2問)。
const QS: FlopRbQuestion[] = [
  { id: 1, pot: 'SRP', kind: 'cb', variant: 'cor_btnc', hero: 'CO', villain: 'BTN', board: board(),
    choices: ['check', '33', '50', '75', '125'], strat: { check: 0.5, '33': 0.5, '50': 0, '75': 0, '125': 0 }, preflopActions: [], similar: [] },
  { id: 2, pot: '3bet', kind: 'cb', variant: 'utgr_btnr_utgc', hero: 'UTG', villain: 'BTN', board: board(),
    choices: ['check', '33', '50', '75', '125'], strat: { check: 0.2, '33': 0.4, '50': 0.4, '75': 0, '125': 0 }, preflopActions: [], similar: [] },
];

beforeEach(() => {
  hoisted.admin = true;
  vi.mocked(navigate).mockReset();
  vi.mocked(saveFlopRbRecords).mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response));
  vi.mocked(generateFlopRbQuestions).mockResolvedValue(QS.map((q) => ({ ...q })));
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayFlopIntermediate admin デバッグ (全CB)', () => {
  it('全問正解: 主要サイズ選択で全問 finalScore=2、満点へ', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayFlopIntermediate level={LEVEL} />);
    await user.click(await screen.findByRole('button', { name: '全問正解' }));

    const records = vi.mocked(saveFlopRbRecords).mock.calls[0][1];
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.finalScore === 2)).toBe(true);
    expect(vi.mocked(navigate).mock.calls[0][0]).toContain('score=4'); // 2問×2pt
    expect(vi.mocked(navigate).mock.calls[0][0]).toContain('total=40');
  });

  it('非 admin にはデバッグバーを出さない', async () => {
    hoisted.admin = false;
    render(<TrainingPlayFlopIntermediate level={LEVEL} />);
    await screen.findByText('srp CO vs BTN');
    expect(screen.queryByText('DEBUG')).toBeNull();
  });
});
