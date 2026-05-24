// @vitest-environment jsdom
// フロップ初級 結果画面: 振り返り一覧 (○/✕ + シナリオ + ボード)、タップで頻度詳細を展開。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { AuthContext, type AuthState } from '../../contexts/AuthContext';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import { saveFlopRecords, clearFlopRecords } from '../../data/training/flopRecordsStore';
import type { FlopRecord } from '../../data/training/flopBeginner';

vi.mock('../../api/account', async (orig) => ({
  ...(await orig<typeof import('../../api/account')>()),
  apiSubmitTrainingResult: vi.fn().mockResolvedValue({
    is_best: true, previous_best: 0, current_best: 1, total_attempts: 1,
  }),
}));

import { TrainingResultFlop } from './TrainingResultFlop';

const FLOP = TRAINING_CATALOG[1].levels[0];

const REC = (recordId: number, isCorrect: boolean): FlopRecord => ({
  id: recordId,
  recordId,
  type: 'cb',
  pot: 'SRP',
  variant: 'btnr_bbc',
  hero: 'BTN',
  villain: 'BB',
  board: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' }],
  rate: isCorrect ? 0.9 : 0.1,
  threshold: 0.7,
  correct: isCorrect ? 'bet' : 'check',
  actions: [{ code: 'X', freq: 0.1, bp: 0 }, { code: 'R2', freq: 0.9, bp: 0.33 }],
  preflopActions: [],
  choice: 'bet',
  isCorrect,
});

function fakeAuth(): AuthState {
  return {
    status: 'authenticated',
    account: { id: 1, poker_name: 'テスト君', is_admin: false, is_ranking_excluded: false },
    sessionId: 'sid',
    signedOutReason: null,
    login: async () => {},
    signup: async () => {},
    logout: async () => {},
  };
}

function renderFlop() {
  return render(
    <AuthContext.Provider value={fakeAuth()}>
      <TrainingResultFlop level={FLOP} />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  clearFlopRecords(FLOP.key);
  window.history.replaceState({}, '', `/quiz/${FLOP.key}/result?score=1&total=2`);
});
afterEach(() => {
  sessionStorage.clear();
  clearFlopRecords(FLOP.key);
});

describe('TrainingResultFlop 振り返り', () => {
  it('振り返り一覧と内訳 (正解/不正解) を表示する', () => {
    saveFlopRecords(FLOP.key, [REC(1, true), REC(2, false)]);
    renderFlop();
    expect(screen.getByText(/振り返り一覧 \(2問\)/)).toBeTruthy();
    expect(screen.getByText('正解')).toBeTruthy();
    expect(screen.getByText('不正解')).toBeTruthy();
    // シナリオラベル (srp BTN vs BB)
    expect(screen.getAllByText('srp BTN vs BB').length).toBe(2);
  });

  it('問題をタップすると頻度詳細 (正解 + あなたの回答) が展開される', async () => {
    const user = userEvent.setup();
    saveFlopRecords(FLOP.key, [REC(1, true)]);
    renderFlop();
    // 展開前は詳細なし
    expect(screen.queryByText(/あなたの回答/)).toBeNull();
    await user.click(screen.getByRole('button', { name: /srp BTN vs BB/ }));
    expect(screen.getByText(/あなたの回答/)).toBeTruthy();
    expect(screen.getByText(/正解:/)).toBeTruthy();
  });

  it('記録が無くてもスコアは表示される (クラッシュしない)', () => {
    renderFlop();
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.queryByText(/振り返り一覧/)).toBeNull();
  });
});
