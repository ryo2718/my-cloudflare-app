// @vitest-environment jsdom
// admin デバッグ (共有 DebugAnswerBar + harness.debugComplete) が複数選択モードでも動くこと。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import type { FlopCbQuestion } from '../../data/training/flopIntermediateCb';
import { saveInstantFeedback } from '../../data/userPreferences';

const hoisted = vi.hoisted(() => ({ admin: true }));

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ account: { is_admin: hoisted.admin }, sessionId: null }),
}));
vi.mock('../../data/training/flopCbRecordsStore', () => ({
  saveFlopCbRecords: vi.fn(),
  clearFlopCbRecords: vi.fn(),
  loadFlopCbRecords: vi.fn(),
}));
vi.mock('../../data/training/flopIntermediateCb', async (orig) => ({
  ...(await orig<typeof import('../../data/training/flopIntermediateCb')>()),
  generateFlopCbQuestions: vi.fn(),
}));

import { navigate } from '../../router/router-core';
import { saveFlopCbRecords } from '../../data/training/flopCbRecordsStore';
import { generateFlopCbQuestions } from '../../data/training/flopIntermediateCb';
import { TrainingPlayFlopIntermediate } from './TrainingPlayFlopIntermediate';

const LEVEL = TRAINING_CATALOG[1].levels[1]; // flop_intermediate (中級CB)

function makeQ(id: number): FlopCbQuestion {
  return {
    id,
    potCat: 'SRP',
    pot: 'SRP',
    variant: 'cor_btnc',
    hero: 'CO',
    villain: 'BTN',
    board: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' }],
    choices: ['check', '33', '50', '75', '125'],
    strat: { check: 0.5, '33': 0.5, '50': 0, '75': 0, '125': 0 }, // check/33 が主要
    preflopActions: [],
  };
}
const QS = [makeQ(1), makeQ(2)];

beforeEach(() => {
  hoisted.admin = true;
  vi.mocked(navigate).mockReset();
  vi.mocked(saveFlopCbRecords).mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response));
  vi.mocked(generateFlopCbQuestions).mockResolvedValue(QS.map((q) => ({ ...q })));
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayFlopIntermediate admin デバッグ', () => {
  it('全問正解: 全問 finalScore=2、score=満点で結果へ', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayFlopIntermediate level={LEVEL} />);
    await user.click(await screen.findByRole('button', { name: '全問正解' }));

    const records = vi.mocked(saveFlopCbRecords).mock.calls[0][1];
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.finalScore === 2)).toBe(true);
    expect(vi.mocked(navigate).mock.calls[0][0]).toContain('score=4'); // 2問×2pt
    expect(vi.mocked(navigate).mock.calls[0][0]).toContain('total=60');
  });

  it('非 admin にはデバッグバーを出さない', async () => {
    hoisted.admin = false;
    render(<TrainingPlayFlopIntermediate level={LEVEL} />);
    await screen.findByText('srp CO vs BTN');
    expect(screen.queryByText('DEBUG')).toBeNull();
    expect(screen.queryByRole('button', { name: '全問正解' })).toBeNull();
  });
});
