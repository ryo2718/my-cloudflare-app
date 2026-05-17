import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomePage } from './HomePage';
import { AuthContext, type AuthState } from '../contexts/AuthContext';

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
      <HomePage />
    </AuthContext.Provider>,
  );
}

describe('<HomePage />', () => {
  it('poker_name + Strategy/Quiz リンク表示', () => {
    const html = render(makeAuth());
    expect(html).toContain('テスト君');
    expect(html).toContain('Strategy');
    expect(html).toContain('Quiz');
    expect(html).toContain('href="/strategy"');
    expect(html).toContain('href="/quiz"');
  });

  it('一般ユーザー: 管理画面リンクは出ない', () => {
    const html = render(makeAuth());
    expect(html).not.toContain('href="/admin"');
  });

  it('admin: 管理画面リンクが出る', () => {
    const html = render(
      makeAuth({ account: { id: 1, poker_name: 'admin', is_admin: true } }),
    );
    expect(html).toContain('href="/admin"');
    expect(html).toContain('管理画面');
  });

  it('ヘッダにログアウトボタン', () => {
    const html = render(makeAuth());
    expect(html).toContain('ログアウト');
  });
});
