import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuizPage } from './QuizPage';
import { AuthContext, type AuthState } from '../contexts/AuthContext';

function makeAuth(): AuthState {
  return {
    status: 'authenticated',
    account: { id: 1, poker_name: 'テスト君', is_admin: false },
    sessionId: 'sid',
    login: async () => {},
    signup: async () => {},
    logout: async () => {},
  };
}

function render(): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={makeAuth()}>
      <QuizPage />
    </AuthContext.Provider>,
  );
}

describe('<QuizPage /> (level-accordion トレーニングメニュー)', () => {
  it('タイトル "トレーニング" 表示', () => {
    const html = render();
    expect(html).toContain('トレーニング');
  });

  it('プリフロップ / フロップ 2 カテゴリ表示', () => {
    const html = render();
    expect(html).toContain('プリフロップトレーニング');
    expect(html).toContain('フロップトレーニング');
  });

  it('4 レベル × 2 カテゴリ = 8 カード分のラベル', () => {
    const html = render();
    const beginnerCount = (html.match(/>初級</g) ?? []).length;
    const intermediateCount = (html.match(/>中級</g) ?? []).length;
    const advancedCount = (html.match(/>上級</g) ?? []).length;
    const expertCount = (html.match(/>超上級</g) ?? []).length;
    expect(beginnerCount).toBe(2);
    expect(intermediateCount).toBe(2);
    expect(advancedCount).toBe(2);
    expect(expertCount).toBe(2);
  });

  it('プリフロップ初級・中級 subtitle: "(オープンレンジ)" "(vs open)" が collapsed 状態でも見える', () => {
    const html = render();
    expect(html).toContain('(オープンレンジ)');
    expect(html).toContain('(vs open)');
  });

  it('未挑戦の playable level は "未挑戦" 表示 (collapsed 状態)', () => {
    const html = render();
    // 認証ありだが SSR で fetch 結果は来ないので、両 playable level は未挑戦扱い
    const matches = html.match(/未挑戦/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('未実装 level は「未実装」バッジ表示 (preflop 上級/超上級 + flop 全 = 6 枚)', () => {
    const html = render();
    const matches = html.match(/>未実装</g) ?? [];
    expect(matches.length).toBe(6);
  });

  it('collapsed 初期状態では [スタート] ボタンは含まれない (展開時のみ表示)', () => {
    const html = render();
    // 詳細パネルは展開時のみ。初期 SSR では全 level collapsed → スタート 0件
    expect(html).not.toContain('>スタート<');
  });

  it('playable level はアコーディオン展開可能 (aria-expanded="false" を持つボタンが 2 つ)', () => {
    const html = render();
    const matches = html.match(/aria-expanded="false"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('「← ホーム」リンク (AppHeader showBack)', () => {
    const html = render();
    expect(html).toContain('href="/"');
    expect(html).toContain('ホーム');
  });
});
