// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, userEvent } from '../test/ui';
import { QuizPage } from './QuizPage';
import { AuthContext, type AuthState } from '../contexts/AuthContext';

function makeAuth(): AuthState {
  return {
    status: 'authenticated',
    account: { id: 1, poker_name: 'テスト君', is_admin: false, is_ranking_excluded: false },
    sessionId: 'sid',
    signedOutReason: null,
    login: async () => {},
    signup: async () => {},
    logout: async () => {},
  };
}

function staticHtml(): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={makeAuth()}>
      <QuizPage />
    </AuthContext.Provider>,
  );
}

function renderPage() {
  return render(
    <AuthContext.Provider value={makeAuth()}>
      <QuizPage />
    </AuthContext.Provider>,
  );
}

describe('<QuizPage /> 静的表示', () => {
  it('タイトル "トレーニング" 表示', () => {
    expect(staticHtml()).toContain('トレーニング');
  });

  it('プリフロップ / フロップ 2 カテゴリ表示', () => {
    const html = staticHtml();
    expect(html).toContain('プリフロップトレーニング');
    expect(html).toContain('フロップトレーニング');
  });

  it('4 階級 (初級/中級/上級/超上級) の見出しを表示', () => {
    const html = staticHtml();
    expect(html).toContain('>初級<');
    expect(html).toContain('>中級<');
    expect(html).toContain('>上級<');
    expect(html).toContain('>超上級<');
  });

  it('全階級が既定で閉じている (aria-expanded=false / スタート・準備中は未描画)', () => {
    const html = staticHtml();
    expect(html).toContain('aria-expanded="false"');
    // 階級アコーディオンが閉じているのでレベル行 (スタート) や準備中は出ない。
    expect(html).not.toContain('>スタート<');
    expect(html).not.toContain('準備中');
  });

  it('見出しに合計点 (current/max) を表示。実装済み階級の満点のみが分母', () => {
    const html = staticHtml();
    // 未挑戦なので current=0。preflop 初級 = 基礎20 + オープン10 + vsオープン20 + vs3bet4bet20 = 70pt。
    expect(html).toContain('/ 70pt');
    // preflop 中級 = 総合40 + EP20 + LP20 + Blind30 = 110pt。
    expect(html).toContain('/ 110pt');
    // flop 初級 = 20pt、flop 中級 = CB60×2 + ドンク60 = 180pt。
    expect(html).toContain('/ 20pt');
    expect(html).toContain('/ 180pt');
  });

  it('全モード未実装の階級 (上級/超上級) は合計点の代わりに「未実装」表示', () => {
    const html = staticHtml();
    expect(html).toContain('未実装');
  });

  it('subtitle (オープンレンジ / vs open 等の装飾文言) を表示しない', () => {
    const html = staticHtml();
    expect(html).not.toContain('オープンレンジ');
    expect(html).not.toContain('vs open');
  });

  it('一覧にソリューション条件 (スタック/レーキ/open額) を表示しない', () => {
    const html = staticHtml();
    expect(html).not.toContain('スタック: 100BB');
    expect(html).not.toContain('2.5BB open');
  });

  it('「← ホーム」リンク (AppHeader showBack)', () => {
    const html = staticHtml();
    expect(html).toContain('href="/"');
    expect(html).toContain('ホーム');
  });
});

describe('<QuizPage /> アコーディオン開閉', () => {
  it('初級見出しをタップで展開 → スタート/ルールを確認 が出る。再タップで閉じる', async () => {
    const user = userEvent.setup();
    renderPage();
    // 既定は閉じている。
    expect(screen.queryByText('スタート')).toBeNull();
    // 「初級」見出しボタン (プリフロップ/フロップで 2 つ) の先頭を展開。
    const beginnerHeaders = screen.getAllByRole('button', { name: /初級/ });
    await user.click(beginnerHeaders[0]);
    // 初級 基礎 (解放済み) のスタート/ルール確認が出る。
    expect(screen.getAllByText('スタート').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ルールを確認').length).toBeGreaterThanOrEqual(1);
    // 再タップで閉じる。
    await user.click(beginnerHeaders[0]);
    expect(screen.queryByText('スタート')).toBeNull();
  });

  it('中級を展開すると短縮ラベル (総合問題 / EP(UTG,HJ) / Blind(SB,BB)) が出る', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByText('EP(UTG,HJ)')).toBeNull();
    const tierHeaders = screen.getAllByRole('button', { name: /中級/ });
    await user.click(tierHeaders[0]); // preflop 中級
    // 中級は未解放なので "🔒 総合問題" 等のロック表示 (部分一致で確認)。
    expect(screen.getByText('総合問題', { exact: false })).toBeTruthy();
    expect(screen.getByText('EP(UTG,HJ)', { exact: false })).toBeTruthy();
    expect(screen.getByText('Blind(SB,BB)', { exact: false })).toBeTruthy();
  });

  it('上級を展開すると「準備中」が出る (全モード未実装)', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByText('準備中')).toBeNull();
    const tierHeaders = screen.getAllByRole('button', { name: /上級/ });
    await user.click(tierHeaders[0]);
    expect(screen.getAllByText('準備中').length).toBeGreaterThanOrEqual(1);
  });

  it('初級を展開するとロック中モード (初級 オープン) に 🔒 + ヒントが出る', async () => {
    const user = userEvent.setup();
    renderPage();
    const beginnerHeaders = screen.getAllByRole('button', { name: /初級/ });
    await user.click(beginnerHeaders[0]); // preflop 初級
    expect(screen.getAllByText(/🔒/).length).toBeGreaterThanOrEqual(1);
    // オープン / vs オープン の 2 モードがロック → 同じヒントが複数。
    expect(screen.getAllByText('プリフロップ初級 基礎をクリアするとアンロック').length).toBeGreaterThanOrEqual(1);
  });
});
