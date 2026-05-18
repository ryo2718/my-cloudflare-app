import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuizPage } from './QuizPage';
import { AuthContext, type AuthState } from '../contexts/AuthContext';

function makeAuth(): AuthState {
  return {
    status: 'authenticated',
    account: { id: 1, poker_name: 'テスト君', is_admin: false, is_ranking_excluded: false },
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

  it('4 レベル × 2 カテゴリ = 8 カード分のラベル (ロック表示 + MissedProblemsSection の select option 含む)', () => {
    const html = render();
    // ロック中は "🔒 中級" の prefix。
    // 加えて MissedProblemsSection の <option>初級</option><option>中級</option> でそれぞれ +1。
    const countText = (label: string) =>
      (html.match(new RegExp(`>(?:🔒 )?${label}<`, 'g')) ?? []).length;
    expect(countText('初級')).toBe(3);   // カード 2 + select option 1
    expect(countText('中級')).toBe(3);   // カード 2 + select option 1
    expect(countText('上級')).toBe(2);
    expect(countText('超上級')).toBe(2);
  });

  it('subtitle (オープンレンジ / vs open 等の装飾文言) を表示しない', () => {
    const html = render();
    expect(html).not.toContain('オープンレンジ');
    expect(html).not.toContain('vs open');
  });

  it('未挑戦の初級は "未挑戦" 表示 (collapsed 状態)', () => {
    const html = render();
    const matches = html.match(/未挑戦/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('未実装 level は「未実装」バッジ表示 (preflop 上級/超上級 + flop 全 = 6 枚)', () => {
    // preflop_advanced / preflop_expert は implemented=false なので unlocked 判定より
    // 先に「未実装」ブランチに入る。中級のみがロック扱い (playable + !unlocked)。
    const html = render();
    const matches = html.match(/>未実装</g) ?? [];
    expect(matches.length).toBe(6);
  });

  it('ロック中 level は "🔒" + ヒント文を表示 (中級: "初級で 20/20 取るとアンロック")', () => {
    const html = render();
    expect(html).toContain('🔒');
    expect(html).toContain('初級で 20/20 取るとアンロック');
  });

  it('collapsed 初期状態では [スタート] ボタンは含まれない', () => {
    const html = render();
    expect(html).not.toContain('>スタート<');
  });

  it('records 空 → 初級だけがアンロック・アコーディオン展開可 (aria-expanded="false" 1 件)', () => {
    const html = render();
    const matches = html.match(/aria-expanded="false"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('「← ホーム」リンク (AppHeader showBack)', () => {
    const html = render();
    expect(html).toContain('href="/"');
    expect(html).toContain('ホーム');
  });
});
