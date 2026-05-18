import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomePage } from './HomePage';
import { AuthContext, type AuthState } from '../contexts/AuthContext';

function makeAuth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    status: 'authenticated',
    account: { id: 1, poker_name: 'テスト君', is_admin: false, is_ranking_excluded: false },
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
  it('タイトルは PokerGTO Viewer (サブタイトル無し)', () => {
    const html = render(makeAuth());
    expect(html).toContain('PokerGTO Viewer');
  });

  it('3 ボタン (戦略 / トレーニング / アカウント情報) と href', () => {
    const html = render(makeAuth());
    expect(html).toContain('>戦略<');
    expect(html).toContain('>トレーニング<');
    expect(html).toContain('>アカウント情報<');
    expect(html).toContain('href="/strategy"');
    expect(html).toContain('href="/quiz"');
    expect(html).toContain('href="/account"');
  });

  it('一般ユーザー: AppHeader の「管理画面」リンクは出ない', () => {
    const html = render(makeAuth());
    expect(html).not.toContain('href="/admin"');
  });

  it('admin: AppHeader の管理画面リンクが出る', () => {
    const html = render(
      makeAuth({ account: { id: 1, poker_name: 'admin', is_admin: true, is_ranking_excluded: false } }),
    );
    expect(html).toContain('href="/admin"');
  });

  it('ヘッダにログアウトボタンと poker_name', () => {
    const html = render(makeAuth());
    expect(html).toContain('ログアウト');
    expect(html).toContain('テスト君');
  });
});
