// @vitest-environment jsdom
// フェーズ3: ランキングページの基本表示 + タブ切替 UI テスト。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../test/ui';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ sessionId: 'sid', account: { poker_name: 'TestPlayer', is_admin: false }, status: 'authenticated', login: vi.fn(), signup: vi.fn(), logout: vi.fn(), signedOutReason: null }),
}));
vi.mock('../utils/season', () => ({ currentSeason: () => ({ number: 5, id: '2026-05', name: 'シーズン5' }) }));
vi.mock('../utils/rank', () => ({ calculateRank: () => ({ label: 'rank' }) }));
vi.mock('../api/ranking', () => ({ apiRanking: vi.fn() }));

import { apiRanking } from '../api/ranking';
import { RankingPage } from './RankingPage';

const RESP = (type: 'total' | 'season') => ({
  ranking: [
    { rank: 1, poker_name: 'Alice', points_visible: true, total_points: 500, achievement_ids: [] },
    { rank: 2, poker_name: 'TestPlayer', points_visible: true, total_points: 400, achievement_ids: [] },
  ],
  reference: [],
  my_rank: 2,
  hide_points_reason: null,
  type,
  season: { id: '2026-05', number: 5, name: 'シーズン5' },
});

beforeEach(() => {
  vi.mocked(apiRanking).mockImplementation((async (_sid: string, type?: 'total' | 'season') => RESP(type ?? 'total')) as unknown as typeof apiRanking);
});

describe('RankingPage (UI)', () => {
  it('タイトル・タブ・ランキング行を表示する', async () => {
    render(<RankingPage />);
    expect(screen.getByText('ランキング')).toBeTruthy();
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getByRole('tab', { name: '累計' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'シーズン5' })).toBeTruthy();
    expect(screen.getAllByText('TestPlayer').length).toBeGreaterThan(0); // ヘッダ名 + 自分の行
  });

  it('シーズンタブで apiRanking(season) を呼ぶ', async () => {
    const user = userEvent.setup();
    render(<RankingPage />);
    await screen.findByText('Alice'); // total ロード完了
    await user.click(screen.getByRole('tab', { name: 'シーズン5' }));
    await screen.findByText('Alice'); // season ロード完了
    expect(vi.mocked(apiRanking).mock.calls.some((c) => c[1] === 'season')).toBe(true);
  });
});
