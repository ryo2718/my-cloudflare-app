// @vitest-environment jsdom
// フロップ中級レンジベット 結果画面: 内訳 (◎○△×) + 振り返り一覧 (全CB: 頻度詳細 + 似たボード)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { AuthContext, type AuthState } from '../../contexts/AuthContext';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import { saveFlopRbRecords, clearFlopRbRecords } from '../../data/training/flopCbRecordsStore';
import type { FlopRbRecord } from '../../data/training/flopIntermediateCb';

vi.mock('../../api/account', async (orig) => ({
  ...(await orig<typeof import('../../api/account')>()),
  apiSubmitTrainingResult: vi.fn().mockResolvedValue({
    is_best: true, previous_best: 0, current_best: 54, total_attempts: 1,
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
    id: recordId, recordId, pot: 'SRP', kind: 'cb', variant: 'cor_btnc', hero: 'CO', villain: 'BTN',
    board: board(), choices: ['check', '33', '50', '75', '125'],
    strat: { check: 0.4, '33': 0.4, '50': 0.2, '75': 0, '125': 0 },
    preflopActions: [],
    similar: [
      {
        board: [{ rank: 'Q', suit: 'h' }, { rank: '7', suit: 'h' }, { rank: '2', suit: 'c' }],
        pot: 'SRP',
        strat: { check: 0.3, '33': 0.5, '50': 0.2, '75': 0, '125': 0 },
      },
    ],
    response: { kind: 'select', selections: ['check', '33'] },
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
  window.history.replaceState({}, '', `/quiz/${LEVEL.key}/result?score=54&total=60`);
});
afterEach(() => {
  sessionStorage.clear();
  clearFlopRbRecords(LEVEL.key);
});

describe('TrainingResultFlopIntermediate', () => {
  it('スコア・内訳・振り返り一覧を表示する', () => {
    saveFlopRbRecords(LEVEL.key, [cbRec(1, 2), cbRec(2, 1), cbRec(3, -1)]);
    renderResult();
    expect(screen.getByText('54/60')).toBeTruthy();
    expect(screen.getByText(/振り返り一覧 \(3問\)/)).toBeTruthy();
    expect(screen.getByText('スコア内訳')).toBeTruthy();
  });

  it('CB問題タップで頻度詳細 + 似た頻度のボードが展開される', async () => {
    const user = userEvent.setup();
    saveFlopRbRecords(LEVEL.key, [cbRec(1, 1)]);
    renderResult();
    expect(screen.queryByText('あなた')).toBeNull();
    await user.click(screen.getByRole('button', { name: /srp CO vs BTN/ }));
    expect(screen.getByText('チェック')).toBeTruthy();
    expect(screen.getByText('ベット33%')).toBeTruthy();
    expect(screen.getAllByText('あなた').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('似たベット頻度のボード')).toBeTruthy();
  });

  it('記録が無くてもスコアは表示 (クラッシュしない)', () => {
    renderResult();
    expect(screen.getByText('54/60')).toBeTruthy();
    expect(screen.queryByText(/振り返り一覧/)).toBeNull();
  });
});
