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
  apiAccountTrainingResults: vi.fn(async () => [
    // SRP Blind以外 は満点 40 中 24 → 60%
    { id: 1, account_id: 1, training_type: 'srp_non_blind', best_score: 24, best_score_at: 0, total_attempts: 1, updated_at: 0, season_score: 0, season_id: '2026-05' },
  ]),
}));

import { AchievementTierPage } from './AchievementTierPage';

beforeEach(() => {});

describe('AchievementTierPage (UI)', () => {
  it('ビギナー(shrimp)ティアの基本表示 (パンくず・達成数・他の実績)', async () => {
    render(<AchievementTierPage tier="shrimp" />);
    expect(screen.getByText('← アカウントに戻る')).toBeTruthy();
    expect(await screen.findByText(/\d+ \/ \d+ 達成/)).toBeTruthy();
    expect(screen.getByText('他の実績')).toBeTruthy();
  });

  it('スタンダード(fish): 新形式の名前と「現在の最高点数 X%」を表示する', async () => {
    render(<AchievementTierPage tier="fish" />);
    // 名前は「カテゴリ 階級 モード 目標%」形式。
    expect(await screen.findByText('ポストフロップ 中級 SRP Blind以外 80%')).toBeTruthy();
    // best_score 24/40 → 現在の最高点数 60%。
    expect(screen.getByText('現在の最高点数 60%')).toBeTruthy();
    // 13 個ぶん表示 (達成数 0/13)。
    expect(screen.getByText('0 / 13 達成')).toBeTruthy();
    // ランク到達バッジ: 10 個でスタンダード → 0 個達成なので「あと 10 個」。
    expect(screen.getByText('あと 10 個でスタンダードランク到達')).toBeTruthy();
  });
});
