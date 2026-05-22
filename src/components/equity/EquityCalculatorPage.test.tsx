// @vitest-environment jsdom
// フェーズ3: エクイティ計算ページの UI テスト (計算は mock、実ネットワーク非依存)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';

// AppHeader が useAuth を使うためモック (ページ自体は auth 非依存)。
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ sessionId: 'sid', account: { poker_name: 'T', is_admin: false }, status: 'authenticated', login: vi.fn(), signup: vi.fn(), logout: vi.fn(), signedOutReason: null }),
}));
vi.mock('../../utils/equity', () => ({
  computeEquity: vi.fn(() => ({ a: 45.5, b: 54.5, tie: 0, total: 100 })),
}));
vi.mock('../../utils/rangeEquity', () => ({
  computeRangeEquity: vi.fn(() => ({ a: 40, b: 60, tie: 0, method: 'enumerate', pairs: 100, samples: 0 })),
}));

import { EquityCalculatorPage } from './EquityCalculatorPage';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as unknown as Response));
});
afterEach(() => vi.unstubAllGlobals());

describe('EquityCalculatorPage (UI)', () => {
  it('タイトルと主要コントロールを表示する', () => {
    render(<EquityCalculatorPage />);
    expect(screen.getByText('エクイティ計算')).toBeTruthy();
    expect(screen.getByText('Player A')).toBeTruthy();
    expect(screen.getByText('Player B')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'ハンド' }).length).toBe(2);
    expect(screen.getAllByRole('button', { name: 'レンジ' }).length).toBe(2);
    expect(screen.getByRole('button', { name: 'フロップ' })).toBeTruthy();
  });

  it('カード選択→ハンド設定→ボード設定でエクイティ結果が表示される', async () => {
    const user = userEvent.setup();
    render(<EquityCalculatorPage />);

    // Player A: ハンド 2枚
    await user.click(screen.getAllByRole('button', { name: 'ハンド' })[0]);
    await user.click(await screen.findByRole('button', { name: 'A of Spades' }));
    await user.click(screen.getByRole('button', { name: 'K of Spades' }));
    // Player B: ハンド 2枚
    await user.click(screen.getAllByRole('button', { name: 'ハンド' })[1]);
    await user.click(await screen.findByRole('button', { name: 'Q of Hearts' }));
    await user.click(screen.getByRole('button', { name: 'J of Hearts' }));
    // ボード: フロップ 3枚
    await user.click(screen.getByRole('button', { name: 'フロップ' }));
    await user.click(await screen.findByRole('button', { name: '2 of Clubs' }));
    await user.click(screen.getByRole('button', { name: '3 of Clubs' }));
    await user.click(screen.getByRole('button', { name: '4 of Clubs' }));

    // 自動計算 (30ms) 後にエクイティ% が出る
    expect(await screen.findByText('45.5%')).toBeTruthy();
    expect(screen.getByText('54.5%')).toBeTruthy();
  });

  it('レンジモーダルが開く', async () => {
    const user = userEvent.setup();
    render(<EquityCalculatorPage />);
    await user.click(screen.getAllByRole('button', { name: 'レンジ' })[0]);
    expect(await screen.findByRole('dialog', { name: 'レンジ選択' })).toBeTruthy();
  });
});
