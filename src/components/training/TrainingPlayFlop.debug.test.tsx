// @vitest-environment jsdom
// admin 専用デバッグ: 全問正解 / 全問不正解 / ランダム をワンタップで一括解答 → 結果へ。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import type { TrainingLevel } from '../../data/trainingCatalog';
import type { FlopQuestion } from '../../data/training/flopBeginner';
import { saveInstantFeedback } from '../../data/userPreferences';

const hoisted = vi.hoisted(() => ({ admin: true }));

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ account: { is_admin: hoisted.admin }, sessionId: null }),
}));
vi.mock('../../data/training/flopRecordsStore', () => ({
  saveFlopRecords: vi.fn(),
  loadFlopRecords: vi.fn(),
  clearFlopRecords: vi.fn(),
}));
vi.mock('../../data/training/flopBeginner', async (orig) => ({
  ...(await orig<typeof import('../../data/training/flopBeginner')>()),
  generateFlopBeginnerQuestions: vi.fn(),
}));

import { navigate } from '../../router/router-core';
import { saveFlopRecords } from '../../data/training/flopRecordsStore';
import { generateFlopBeginnerQuestions } from '../../data/training/flopBeginner';
import { TrainingPlayFlop } from './TrainingPlayFlop';

const LEVEL: TrainingLevel = {
  key: 'flop_beginner',
  label: 'フロップ初級',
  points: 1,
  questionCount: 20,
  timeLimitSec: 'none',
  implemented: true,
};

const board = (): FlopQuestion['board'] => [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 'd' },
  { rank: '2', suit: 'c' },
];

function makeQ(id: number, correct: 'bet' | 'check'): FlopQuestion {
  return {
    id,
    type: id === 3 ? 'donk' : 'cb',
    pot: 'SRP',
    variant: 'btnr_bbc',
    hero: 'BTN',
    villain: 'BB',
    board: board(),
    rate: correct === 'bet' ? 0.9 : 0.1,
    threshold: 0.7,
    correct,
    actions: [{ code: 'R2', freq: 0.9, bp: 0.33 }],
    preflopActions: [],
  };
}

// 3問: 正解 = [bet, check, bet]
const QS = [makeQ(1, 'bet'), makeQ(2, 'check'), makeQ(3, 'bet')];

beforeEach(() => {
  hoisted.admin = true;
  vi.mocked(navigate).mockReset();
  vi.mocked(saveFlopRecords).mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response));
  vi.mocked(generateFlopBeginnerQuestions).mockResolvedValue(QS.map((q) => ({ ...q })));
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayFlop admin デバッグ一括解答', () => {
  it('全問正解: 全員 isCorrect=true で score=total の結果へ', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayFlop level={LEVEL} />);
    await user.click(await screen.findByRole('button', { name: '全問正解' }));

    expect(vi.mocked(saveFlopRecords)).toHaveBeenCalledTimes(1);
    const records = vi.mocked(saveFlopRecords).mock.calls[0][1];
    expect(records).toHaveLength(3);
    expect(records.every((r) => r.isCorrect)).toBe(true);
    expect(vi.mocked(navigate).mock.calls[0][0]).toContain('score=3&total=3');
  });

  it('全問不正解: 全員 isCorrect=false で score=0 の結果へ', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayFlop level={LEVEL} />);
    await user.click(await screen.findByRole('button', { name: '全問不正解' }));

    const records = vi.mocked(saveFlopRecords).mock.calls[0][1];
    expect(records.every((r) => !r.isCorrect)).toBe(true);
    expect(vi.mocked(navigate).mock.calls[0][0]).toContain('score=0&total=3');
  });

  it('ランダム: 全問解答され結果へ遷移する', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayFlop level={LEVEL} />);
    await user.click(await screen.findByRole('button', { name: 'ランダム' }));

    const records = vi.mocked(saveFlopRecords).mock.calls[0][1];
    expect(records).toHaveLength(3);
    expect(records.every((r) => r.choice === 'bet' || r.choice === 'check')).toBe(true);
    expect(vi.mocked(navigate).mock.calls[0][0]).toContain('total=3');
  });

  it('非 admin にはデバッグバーを出さない', async () => {
    hoisted.admin = false;
    render(<TrainingPlayFlop level={LEVEL} />);
    // ロード完了 (ready) をヘッダのレベル名で待つ
    await screen.findByText('フロップ初級');
    expect(screen.queryByText('DEBUG')).toBeNull();
    expect(screen.queryByRole('button', { name: '全問正解' })).toBeNull();
  });
});
