// @vitest-environment jsdom
// フェーズ3: 実績/ランクページの基本表示 UI テスト (ティアデータは実物、API は mock)。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/ui';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ sessionId: 'sid', account: { poker_name: 'T', is_admin: false }, status: 'authenticated', login: vi.fn(), signup: vi.fn(), logout: vi.fn(), signedOutReason: null }),
}));
vi.mock('../api/account', async (orig) => ({
  ...(await orig<typeof import('../api/account')>()),
  apiAccountAchievements: vi.fn(async () => ({ unlocked: [], newly_unlocked: [] })),
}));

import { AchievementTierPage } from './AchievementTierPage';

beforeEach(() => {});

describe('AchievementTierPage (UI)', () => {
  it('ビギナー(shrimp)ティアの基本表示 (パンくず・達成数・他の実績)', async () => {
    render(<AchievementTierPage tier="shrimp" />);
    expect(screen.getByText('← アカウントに戻る')).toBeTruthy();
    // 「0 / N 達成」(API mock で unlocked=[])
    expect(await screen.findByText(/\d+ \/ \d+ 達成/)).toBeTruthy();
    expect(screen.getByText('他の実績')).toBeTruthy();
  });
});
