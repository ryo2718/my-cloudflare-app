import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountPage } from './AccountPage';
import { AuthContext, type AuthState } from '../contexts/AuthContext';

beforeEach(() => {
  // fetch を no-op に (effect は server-side では走らないが防御的)
});
afterEach(() => {});

function makeAuth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    status: 'authenticated',
    account: { id: 1, poker_name: 'テスト君', is_admin: false, is_ranking_excluded: false },
    sessionId: 'sid',
    signedOutReason: null,
    login: async () => {},
    signup: async () => {},
    logout: async () => {},
    ...overrides,
  };
}

function render(auth: AuthState): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={auth}>
      <AccountPage />
    </AuthContext.Provider>,
  );
}

describe('<AccountPage />', () => {
  it('タイトル + ユーザー名 + ポイント表記 (ヒーローカード)', () => {
    const html = render(makeAuth());
    expect(html).toContain('アカウント情報');
    expect(html).toContain('テスト君');
    expect(html).toContain('今シーズン');
    expect(html).toContain('累計');
    expect(html).toContain('pt');
    expect(html).toContain('ランクなし'); // 実績未取得 (SSR では unlocked=[] 扱い)
  });

  it('トレーニング成績セクション (プリフロップ/フロップ × 4 levels)', () => {
    const html = render(makeAuth());
    expect(html).toContain('トレーニング成績');
    expect(html).toContain('プリフロップトレーニング');
    expect(html).toContain('フロップトレーニング');
    // 実装済 + 未挑戦 → "未挑戦"
    expect(html).toContain('未挑戦');
    // 未実装 (上級/超上級/フロップ全) → "未実装"
    expect(html).toContain('未実装');
  });

  it('正答率トグル (プリフロップ/ポストフロップ) を表示し、既定はプリフロップ (ポジション別)', () => {
    const html = render(makeAuth());
    expect(html).toContain('プリフロップ');
    expect(html).toContain('ポストフロップ');
    // 既定 preflop ビュー → ポジション別/シナリオ別を表示。
    expect(html).toContain('正答率(ポジション別)');
    expect(html).toContain('正答率(シナリオ別)');
  });

  it('「← ホーム」リンク (AppHeader showBack)', () => {
    const html = render(makeAuth());
    expect(html).toContain('href="/"');
    expect(html).toContain('ホーム');
  });
});
