// @vitest-environment jsdom
// フェーズ3: 戦略タブ (StrategyPage) の基本表示 UI テスト。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../test/ui';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ sessionId: 'sid', account: { poker_name: 'T', is_admin: false }, status: 'authenticated', login: vi.fn(), signup: vi.fn(), logout: vi.fn(), signedOutReason: null }),
}));
vi.mock('../hooks/useViewportMode', () => ({ useViewportMode: () => ({ mode: 'pc', toggle: vi.fn() }) }));
vi.mock('../hooks/useOpenEvaluation', async (orig) => ({ ...(await orig<typeof import('../hooks/useOpenEvaluation')>()), loadAllOpenNodes: vi.fn(async () => {}) }));
vi.mock('../hooks/use3betEvaluation', async (orig) => ({ ...(await orig<typeof import('../hooks/use3betEvaluation')>()), loadAll3betNodes: vi.fn(async () => {}) }));
vi.mock('../hooks/use4betEvaluation', async (orig) => ({ ...(await orig<typeof import('../hooks/use4betEvaluation')>()), loadAll4betNodes: vi.fn(async () => {}) }));

import { StrategyPage } from './StrategyPage';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hands: {} }) }) as unknown as Response));
});
afterEach(() => vi.unstubAllGlobals());

describe('StrategyPage (UI)', () => {
  it('PC モードでヘッダ・タイトル・タブを表示する', () => {
    render(<StrategyPage />);
    expect(screen.getByText('Preflop Strategy Viewer')).toBeTruthy();
    expect(screen.getByText('Open Range × Response')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preflop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Flop' })).toBeTruthy();
  });
});
