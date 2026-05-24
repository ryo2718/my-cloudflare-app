// @vitest-environment jsdom
// フロップ中級CB 結果画面: 内訳 (◎○△×) + 振り返り一覧 (タップで頻度詳細 + 自分の選択)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { AuthContext, type AuthState } from '../../contexts/AuthContext';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import { saveFlopCbRecords, clearFlopCbRecords } from '../../data/training/flopCbRecordsStore';
import type { FlopCbRecord } from '../../data/training/flopIntermediateCb';

vi.mock('../../api/account', async (orig) => ({
  ...(await orig<typeof import('../../api/account')>()),
  apiSubmitTrainingResult: vi.fn().mockResolvedValue({
    is_best: true, previous_best: 0, current_best: 40, total_attempts: 1,
  }),
}));

import { TrainingResultFlopIntermediate } from './TrainingResultFlopIntermediate';

// flop_intermediate = 中級CB
const LEVEL = TRAINING_CATALOG[1].levels[1];

function rec(recordId: number, finalScore: number): FlopCbRecord {
  return {
    id: recordId,
    recordId,
    potCat: 'SRP',
    pot: 'SRP',
    variant: 'cor_btnc',
    hero: 'CO',
    villain: 'BTN',
    board: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' }],
    choices: ['check', '33', '50', '75', '125'],
    strat: { check: 0.4, '33': 0.4, '50': 0.2, '75': 0, '125': 0 },
    preflopActions: [],
    selections: ['check', '33'],
    timedOut: false,
    rawScore: finalScore,
    finalScore,
    theoreticalMax: 2,
  };
}

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

function renderResult() {
  return render(
    <AuthContext.Provider value={fakeAuth()}>
      <TrainingResultFlopIntermediate level={LEVEL} />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  clearFlopCbRecords(LEVEL.key);
  window.history.replaceState({}, '', `/quiz/${LEVEL.key}/result?score=40&total=60`);
});
afterEach(() => {
  sessionStorage.clear();
  clearFlopCbRecords(LEVEL.key);
});

describe('TrainingResultFlopIntermediate', () => {
  it('スコア・内訳・振り返り一覧を表示する', () => {
    saveFlopCbRecords(LEVEL.key, [rec(1, 2), rec(2, 1), rec(3, -1)]);
    renderResult();
    expect(screen.getByText('40/60')).toBeTruthy();
    expect(screen.getByText(/振り返り一覧 \(3問\)/)).toBeTruthy();
    expect(screen.getByText('スコア内訳')).toBeTruthy();
  });

  it('問題タップで頻度詳細 (選択肢ラベル + あなた) が展開される', async () => {
    const user = userEvent.setup();
    saveFlopCbRecords(LEVEL.key, [rec(1, 1)]);
    renderResult();
    expect(screen.queryByText('あなた')).toBeNull();
    await user.click(screen.getByRole('button', { name: /srp CO vs BTN/ }));
    expect(screen.getByText('チェック')).toBeTruthy();
    expect(screen.getByText('ベット33%')).toBeTruthy();
    expect(screen.getAllByText('あなた').length).toBeGreaterThanOrEqual(1); // 選択した check/33 に付く
  });

  it('記録が無くてもスコアは表示 (クラッシュしない)', () => {
    renderResult();
    expect(screen.getByText('40/60')).toBeTruthy();
    expect(screen.queryByText(/振り返り一覧/)).toBeNull();
  });
});
