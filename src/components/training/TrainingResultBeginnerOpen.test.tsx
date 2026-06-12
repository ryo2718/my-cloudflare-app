// @vitest-environment jsdom
// 初級オープンの結果画面: 全問の「答え一覧」(ポジション+ハンド / 正解% / 自分の回答%) が出ること。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/ui';
import { AuthContext, type AuthState } from '../../contexts/AuthContext';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import {
  saveBeginnerOpenRecords,
  clearBeginnerOpenRecords,
  type BeginnerOpenRecord,
} from '../../data/training/beginnerOpenRecordsStore';

vi.mock('../../api/account', async (orig) => ({
  ...(await orig<typeof import('../../api/account')>()),
  apiSubmitTrainingResult: vi.fn(),
}));

import { apiSubmitTrainingResult } from '../../api/account';
import { TrainingResult } from './TrainingResult';

const OPEN = TRAINING_CATALOG[0].levels.find((l) => l.key === 'preflop_beginner_open')!;

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

const RECORDS: BeginnerOpenRecord[] = [
  { id: 1, position: 'HJ', hand: 'Q7s', raisePct: 50, answerPct: 30, points: 0 },
  { id: 2, position: 'BTN', hand: 'K9o', raisePct: 100, answerPct: 100, points: 0.5 },
  { id: 3, position: 'SB', hand: 'A5s', raisePct: 100, answerPct: null, points: 0 },
];

function renderResult() {
  return render(
    <AuthContext.Provider value={fakeAuth()}>
      <TrainingResult level={OPEN} />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  clearBeginnerOpenRecords(OPEN.key);
  vi.mocked(apiSubmitTrainingResult).mockReset();
  vi.mocked(apiSubmitTrainingResult).mockResolvedValue({
    is_best: true, previous_best: 0, current_best: 1, total_attempts: 1,
  });
  window.history.replaceState({}, '', `/quiz/${OPEN.key}/result?score=1&total=3`);
});
afterEach(() => {
  sessionStorage.clear();
  clearBeginnerOpenRecords(OPEN.key);
});

describe('初級オープン 結果画面の答え一覧', () => {
  it('答え一覧セクションが全問ぶん表示される', async () => {
    saveBeginnerOpenRecords(OPEN.key, RECORDS);
    renderResult();
    expect(await screen.findByText('答え一覧 (3問)')).toBeTruthy();
  });

  it('各問のシナリオ (ポジション + オープン) が初級基礎と同じ pill で出る', async () => {
    saveBeginnerOpenRecords(OPEN.key, RECORDS);
    renderResult();
    expect(await screen.findByText('HJ オープン')).toBeTruthy();
    expect(screen.getByText('BTN オープン')).toBeTruthy();
    expect(screen.getByText('SB オープン')).toBeTruthy();
  });

  it('正解=○ / 不正解=✕ の判定アイコンが出る', async () => {
    saveBeginnerOpenRecords(OPEN.key, RECORDS);
    const { container } = renderResult();
    await screen.findByText('答え一覧 (3問)');
    const text = container.textContent ?? '';
    expect(text).toContain('○'); // 2問目 (points>0)
    expect(text).toContain('✕'); // 1・3問目 (points=0)
  });

  it('正解レイズ% と 自分の回答% が出る (スキップ/時間切れは —)', async () => {
    saveBeginnerOpenRecords(OPEN.key, RECORDS);
    const { container } = renderResult();
    await screen.findByText('答え一覧 (3問)');
    const text = container.textContent ?? '';
    // 1問目: あなた 30% / 正解 50%
    expect(text).toContain('30%');
    expect(text).toContain('50%');
    // 3問目: 回答なし (null) は — 表示
    expect(text).toContain('—');
  });

  it('記録が無ければ答え一覧は出ない', async () => {
    renderResult();
    await waitFor(() => expect(vi.mocked(apiSubmitTrainingResult)).toHaveBeenCalled());
    expect(screen.queryByText(/答え一覧/)).toBeNull();
  });
});
