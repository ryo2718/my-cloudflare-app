// @vitest-environment jsdom
// 答え合わせの構造的統一: AnswerReviewRecord を保存した「任意のモード」の結果画面 /
// 振り返り画面に、追加配線なしで答え合わせが出ることを確認する (初級オープン / vs オープンで検証)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/ui';
import { AuthContext, type AuthState } from '../../contexts/AuthContext';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';
import {
  saveAnswerReview,
  clearAnswerReview,
  type AnswerReviewRecord,
} from '../../data/training/answerReviewStore';

vi.mock('../../api/account', async (orig) => ({
  ...(await orig<typeof import('../../api/account')>()),
  apiSubmitTrainingResult: vi.fn(),
}));

import { apiSubmitTrainingResult } from '../../api/account';
import { TrainingResult } from './TrainingResult';
import { TrainingReview } from './TrainingReview';

const OPEN = TRAINING_CATALOG[0].levels.find((l) => l.key === 'preflop_beginner_open')!;
const VS_OPEN = TRAINING_CATALOG[0].levels.find((l) => l.key === 'preflop_beginner_vs_open')!;

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

const OPEN_RECS: AnswerReviewRecord[] = [
  { id: 1, scenario: 'HJ オープン', hand: 'A5s', nodeFile: 'hj.json', mePosition: 'HJ', correct: true, userText: '50%', correctText: '50%' },
  { id: 2, scenario: 'BTN オープン', hand: 'K9o', nodeFile: 'btn.json', mePosition: 'BTN', correct: false, userText: '—', correctText: '100%' },
];
const VS_OPEN_RECS: AnswerReviewRecord[] = [
  { id: 1, scenario: 'CO オープン → BB', hand: 'A5s', nodeFile: 'cor_bb.json', mePosition: 'BB', correct: true, userText: 'コール', correctText: 'コール100' },
  { id: 2, scenario: 'UTG オープン → SB', hand: 'KJs', nodeFile: 'utgr_sb.json', mePosition: 'SB', correct: false, userText: 'フォールド', correctText: 'レイズ20・フォールド80' },
];

beforeEach(() => {
  sessionStorage.clear();
  clearAnswerReview(OPEN.key);
  clearAnswerReview(VS_OPEN.key);
  vi.mocked(apiSubmitTrainingResult).mockReset();
  vi.mocked(apiSubmitTrainingResult).mockResolvedValue({
    is_best: true, previous_best: 0, current_best: 1, total_attempts: 1,
  });
});
afterEach(() => {
  sessionStorage.clear();
  clearAnswerReview(OPEN.key);
  clearAnswerReview(VS_OPEN.key);
  vi.unstubAllGlobals();
});

function renderResult(level: typeof OPEN) {
  window.history.replaceState({}, '', `/quiz/${level.key}/result?score=1&total=2`);
  return render(
    <AuthContext.Provider value={fakeAuth()}>
      <TrainingResult level={level} />
    </AuthContext.Provider>,
  );
}

describe('結果画面の答え合わせ統一 (TrainingResult)', () => {
  it('初級オープン: 答え一覧が自動表示される', async () => {
    saveAnswerReview(OPEN.key, OPEN_RECS);
    renderResult(OPEN);
    expect(await screen.findByText('答え一覧 (2問)')).toBeTruthy();
    expect(screen.getByText('HJ オープン')).toBeTruthy();
    expect(screen.getByText('BTN オープン')).toBeTruthy();
  });

  it('初級 vs オープン: 同じ構造で答え一覧が自動表示される (追加配線なし)', async () => {
    saveAnswerReview(VS_OPEN.key, VS_OPEN_RECS);
    renderResult(VS_OPEN);
    expect(await screen.findByText('答え一覧 (2問)')).toBeTruthy();
    expect(screen.getByText('CO オープン → BB')).toBeTruthy();
    expect(screen.getByText('UTG オープン → SB')).toBeTruthy();
    // ○/✕ 判定と 問題へ ボタン。
    const text = (screen.getByText('答え一覧 (2問)').closest('section') as HTMLElement).textContent ?? '';
    expect(text).toContain('○');
    expect(text).toContain('✕');
    expect(screen.getAllByText('問題へ').length).toBe(2);
  });

  it('記録が無ければ答え一覧は出ない', async () => {
    renderResult(VS_OPEN);
    await waitFor(() => expect(vi.mocked(apiSubmitTrainingResult)).toHaveBeenCalled());
    expect(screen.queryByText(/答え一覧/)).toBeNull();
  });
});

describe('振り返り画面の統一 (TrainingReview → TrainingReviewGeneric)', () => {
  function renderReview(level: typeof OPEN, index: number) {
    window.history.replaceState({}, '', `/training/${level.key.replace(/_/g, '-')}/review/${index}`);
    return render(
      <AuthContext.Provider value={fakeAuth()}>
        <TrainingReview level={level} index={index} />
      </AuthContext.Provider>,
    );
  }

  it('vs オープン: AnswerReviewRecord があれば汎用振り返りに委譲し、正解/あなたを表示', () => {
    saveAnswerReview(VS_OPEN.key, VS_OPEN_RECS);
    renderReview(VS_OPEN, 2);
    expect(screen.getByText('← 結果に戻る')).toBeTruthy();
    expect(screen.getByText('UTG オープン → SB')).toBeTruthy();
    expect(screen.getByText('レイズ20・フォールド80')).toBeTruthy(); // correctText
    expect(screen.getByText('フォールド')).toBeTruthy(); // userText
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('範囲外 index は「記録が見つかりません」', () => {
    saveAnswerReview(VS_OPEN.key, VS_OPEN_RECS);
    renderReview(VS_OPEN, 99);
    expect(screen.getByText('記録が見つかりません', { exact: false })).toBeTruthy();
  });
});
