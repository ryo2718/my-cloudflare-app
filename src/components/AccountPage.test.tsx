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
    account: { id: 1, poker_name: 'テスト君', is_admin: false },
    sessionId: 'sid',
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
  it('タイトル + poker_name 表示 (auth.account からの fallback)', () => {
    const html = render(makeAuth());
    expect(html).toContain('アカウント情報');
    expect(html).toContain('poker_name');
    expect(html).toContain('テスト君');
  });

  it('ポイント + トレーニング成績セクション枠が表示される', () => {
    const html = render(makeAuth());
    expect(html).toContain('📍');
    expect(html).toContain('ポイント');
    expect(html).toContain('📊');
    expect(html).toContain('トレーニング成績');
    expect(html).toContain('今後アップデート予定');
  });

  it('「← ホーム」リンク (AppHeader showBack)', () => {
    const html = render(makeAuth());
    expect(html).toContain('href="/"');
    expect(html).toContain('ホーム');
  });
});
