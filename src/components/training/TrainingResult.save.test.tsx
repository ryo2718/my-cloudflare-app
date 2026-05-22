// @vitest-environment jsdom
// フェーズ1②: 結果保存失敗時のスコア退避・再保存・退避破棄・二重記録防止。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '../../test/ui';
import { AuthContext, type AuthState } from '../../contexts/AuthContext';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import {
  loadPendingResults,
  __clearAllPendingResults,
} from '../../data/training/pendingResults';

vi.mock('../../api/account', async (orig) => ({
  ...(await orig<typeof import('../../api/account')>()),
  apiSubmitTrainingResult: vi.fn(),
}));

import { apiSubmitTrainingResult } from '../../api/account';
import { TrainingResult } from './TrainingResult';

const BEGINNER = TRAINING_CATALOG[0].levels[0];

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
      <TrainingResult level={BEGINNER} />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  __clearAllPendingResults();
  sessionStorage.clear();
  vi.mocked(apiSubmitTrainingResult).mockReset();
  window.history.replaceState({}, '', `/quiz/${BEGINNER.key}/result?score=10&total=20&mode=beginner`);
});
afterEach(() => {
  __clearAllPendingResults();
  sessionStorage.clear();
});

describe('TrainingResult 保存失敗時の退避・再送', () => {
  it('保存失敗→スコア退避+再保存ボタン、再送成功→退避破棄', async () => {
    const user = userEvent.setup();
    // 1回目は失敗 (失効想定)
    vi.mocked(apiSubmitTrainingResult).mockRejectedValueOnce(new Error('unauthorized'));

    renderResult();

    // 失敗 → 退避 + エラーUI + 再保存ボタン
    expect(await screen.findByText(/結果の保存に失敗しました/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '再保存する' })).toBeTruthy();
    await waitFor(() => expect(loadPendingResults()).toHaveLength(1));
    expect(loadPendingResults()[0]).toMatchObject({ training_type: BEGINNER.key, score: 10 });

    // 2回目 (再保存) は成功
    vi.mocked(apiSubmitTrainingResult).mockResolvedValueOnce({
      is_best: true,
      previous_best: 0,
      current_best: 10,
      total_attempts: 1,
    });
    await user.click(screen.getByRole('button', { name: '再保存する' }));

    // 再送成功 → 退避破棄
    await waitFor(() => expect(loadPendingResults()).toHaveLength(0));
    // 呼び出しは「失敗1 + 再送1」= 2回 (二重記録なし)
    expect(vi.mocked(apiSubmitTrainingResult).mock.calls).toHaveLength(2);
    expect(vi.mocked(apiSubmitTrainingResult).mock.calls.every((c) => c[1].score === 10)).toBe(true);
  });

  it('保存成功時は退避しない', async () => {
    vi.mocked(apiSubmitTrainingResult).mockResolvedValue({
      is_best: true,
      previous_best: 0,
      current_best: 10,
      total_attempts: 1,
    });
    renderResult();
    await waitFor(() => expect(vi.mocked(apiSubmitTrainingResult)).toHaveBeenCalled());
    await waitFor(() => expect(loadPendingResults()).toHaveLength(0));
  });
});
