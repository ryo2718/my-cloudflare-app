// @vitest-environment jsdom
// ポストフロップ 間違えた問題: 一覧の「{ボード} {シチュエーション}」表示と、再出題の空状態。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../test/ui';
import type { MissedProblemRow } from '../../api/missedProblems';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn(), useRoute: () => '/quiz/review/flop/flop_cb_srp' }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ account: null, sessionId: 'sid' }) }));
vi.mock('../AppHeader', () => ({ AppHeader: () => null }));
vi.mock('../../api/missedProblems', async (orig) => ({
  ...(await orig<typeof import('../../api/missedProblems')>()),
  apiGetMissedProblems: vi.fn(),
  apiRemoveMissedProblem: vi.fn(),
}));
// 再構築はデータ fetch を伴うためモック (空に固定)。flopMissedLabel は本物を使う。
vi.mock('../../data/training/flopMissedMode', async (orig) => ({
  ...(await orig<typeof import('../../data/training/flopMissedMode')>()),
  reconstructFlopRbQuestions: vi.fn().mockResolvedValue([]),
  reconstructFlopBeginnerQuestions: vi.fn().mockResolvedValue([]),
}));

import { apiGetMissedProblems } from '../../api/missedProblems';
import { FlopMissedListPage, FlopMissedPlayPage } from './FlopMissedPage';

function flopRow(id: number, meta: object, over: Partial<MissedProblemRow> = {}): MissedProblemRow {
  return {
    id, account_id: 1, training_type: 'flop_cb_srp', scenario_type: 'flop_cb',
    hero_position: 'BTN', opener_position: 'BB', three_bettor_position: null, hand: '-',
    user_selections: '[]', gto_strategy: '{}', score_obtained: 0, is_timeout: 0,
    is_removed_from_review: 0, created_at: 0, metadata: JSON.stringify(meta), ...over,
  };
}

beforeEach(() => {
  vi.mocked(apiGetMissedProblems).mockReset();
});

describe('FlopMissedListPage', () => {
  it('間違えた問題を「{ボード} {シチュエーション}」で一覧する', async () => {
    vi.mocked(apiGetMissedProblems).mockResolvedValue([
      flopRow(1, { board: 'AdAc3d', variant: 'v1', pot: 'SRP', kind: 'cb' }),
      flopRow(2, { board: 'Kh9s7s', variant: 'v2', pot: '3bet', kind: 'cb' }, { hero_position: 'BB', opener_position: 'BTN' }),
    ]);
    render(<FlopMissedListPage trainingType="flop_cb_srp" />);
    // testing-library は連続スペースを1つに正規化するため単一スペースで照合。
    expect(await screen.findByText('Ad Ac 3d srp BTN vs BB')).toBeTruthy();
    expect(screen.getByText('Kh 9s 7s 3bp BB vs BTN')).toBeTruthy();
    // 挑戦するボタン (件数あり=活性)。
    expect(screen.getByRole('button', { name: '挑戦する' })).toBeTruthy();
  });
});

describe('FlopMissedPlayPage', () => {
  it('間違えた問題が無いと「復習できる問題がありません」', async () => {
    vi.mocked(apiGetMissedProblems).mockResolvedValue([]);
    render(<FlopMissedPlayPage trainingType="flop_cb_srp" />);
    expect(await screen.findByText(/復習できる問題がありません/)).toBeTruthy();
  });
});
