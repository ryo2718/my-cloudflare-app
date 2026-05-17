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

describe('<QuizPage /> (トレーニングメニュー)', () => {
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
    // 各カテゴリ 4 ラベル
    const beginnerCount = (html.match(/>初級</g) ?? []).length;
    const intermediateCount = (html.match(/>中級</g) ?? []).length;
    const advancedCount = (html.match(/>上級</g) ?? []).length;
    const expertCount = (html.match(/>超上級</g) ?? []).length;
    expect(beginnerCount).toBe(2);
    expect(intermediateCount).toBe(2);
    expect(advancedCount).toBe(2);
    expect(expertCount).toBe(2);
  });

  it('プリフロップ初級: subtitle "オープンレンジ" + "1pt × 20問・制限時間なし"', () => {
    const html = render();
    expect(html).toContain('(オープンレンジ)');
    expect(html).toContain('1pt × 20問・制限時間なし');
  });

  it('プリフロップ中級: subtitle "vs open" + "3pt × 20問・制限時間 20s"', () => {
    const html = render();
    expect(html).toContain('(vs open)');
    expect(html).toContain('3pt × 20問・制限時間 20s');
  });

  it('未実装 level は「未実装」バッジ表示 (preflop 上級/超上級 + flop 全 = 6 枚)', () => {
    const html = render();
    const matches = html.match(/>未実装</g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(6);
  });

  it('実装済 (preflop 初級・中級) には「挑戦する」ボタン', () => {
    const html = render();
    const matches = html.match(/>挑戦する</g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('「← ホーム」リンク (AppHeader showBack)', () => {
    const html = render();
    expect(html).toContain('href="/"');
    expect(html).toContain('ホーム');
  });
});
