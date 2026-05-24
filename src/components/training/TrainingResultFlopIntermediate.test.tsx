// @vitest-environment jsdom
// フロップ中級レンジベット 結果画面: 内訳 (◎○△×) + 振り返り一覧 (CB=頻度詳細 / Donk=正解頻度)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { AuthContext, type AuthState } from '../../contexts/AuthContext';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import { saveFlopRbRecords, clearFlopRbRecords } from '../../data/training/flopCbRecordsStore';
import type { FlopRbRecord } from '../../data/training/flopIntermediateCb';

vi.mock('../../api/account', async (orig) => ({
  ...(await orig<typeof import('../../api/account')>()),
  apiSubmitTrainingResult: vi.fn().mockResolvedValue({
    is_best: true, previous_best: 0, current_best: 40, total_attempts: 1,
  }),
}));

import { TrainingResultFlopIntermediate } from './TrainingResultFlopIntermediate';

// flop_intermediate = 中級レンジベット
const LEVEL = TRAINING_CATALOG[1].levels[1];

const board = (): FlopRbRecord['board'] => [
  { rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' },
];

function cbRec(recordId: number, finalScore: number): FlopRbRecord {
  return {
    kind: 'cb', id: recordId, recordId, pot: 'SRP', variant: 'cor_btnc', hero: 'CO', villain: 'BTN',
    board: board(), choices: ['check', '33', '50', '75', '125'],
    strat: { check: 0.4, '33': 0.4, '50': 0.2, '75': 0, '125': 0 },
    preflopActions: [],
    response: { kind: 'select', selections: ['check', '33'] },
    finalScore,
  };
}
function donkRec(recordId: number, finalScore: number): FlopRbRecord {
  return {
    kind: 'donk', id: recordId, recordId, pot: '3bet', variant: 'utgr_btnr_utgc', hero: 'UTG', villain: 'BTN',
    board: board(), donkRate: 0.3, preflopActions: [],
    response: { kind: 'slider', pct: 30 },
    finalScore,
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
  clearFlopRbRecords(LEVEL.key);
  window.history.replaceState({}, '', `/quiz/${LEVEL.key}/result?score=40&total=50`);
});
afterEach(() => {
  sessionStorage.clear();
  clearFlopRbRecords(LEVEL.key);
});

describe('TrainingResultFlopIntermediate', () => {
  it('スコア・内訳・振り返り一覧を表示する', () => {
    saveFlopRbRecords(LEVEL.key, [cbRec(1, 2), cbRec(2, 1), donkRec(3, -1)]);
    renderResult();
    expect(screen.getByText('40/50')).toBeTruthy();
    expect(screen.getByText(/振り返り一覧 \(3問\)/)).toBeTruthy();
    expect(screen.getByText('スコア内訳')).toBeTruthy();
  });

  it('CB問題タップで頻度詳細 (選択肢ラベル + あなた) が展開される', async () => {
    const user = userEvent.setup();
    saveFlopRbRecords(LEVEL.key, [cbRec(1, 1)]);
    renderResult();
    expect(screen.queryByText('あなた')).toBeNull();
    await user.click(screen.getByRole('button', { name: /srp CO vs BTN/ }));
    expect(screen.getByText('チェック')).toBeTruthy();
    expect(screen.getByText('ベット33%')).toBeTruthy();
    expect(screen.getAllByText('あなた').length).toBeGreaterThanOrEqual(1);
  });

  it('Donk問題タップで正解ドンク頻度 vs 自分の回答が出る', async () => {
    const user = userEvent.setup();
    saveFlopRbRecords(LEVEL.key, [donkRec(1, 2)]);
    renderResult();
    await user.click(screen.getByRole('button', { name: /3bp UTG vs BTN/ }));
    expect(screen.getByText(/ドンク正解 30% \/ あなた 30%/)).toBeTruthy();
  });

  it('記録が無くてもスコアは表示 (クラッシュしない)', () => {
    renderResult();
    expect(screen.getByText('40/50')).toBeTruthy();
    expect(screen.queryByText(/振り返り一覧/)).toBeNull();
  });
});
