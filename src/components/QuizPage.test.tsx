import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
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

  it('各レベルのラベル表示 (ロック表示 + MissedProblemsSection の各レベルカード含む)', () => {
    const html = render();
    // ロック中は "🔒 ◯◯" の prefix。
    // MissedProblemsSection が「プリフロップトレーニング」配下に
    // 初級 / 中級 / 上級 (未実装) の 3 カードを描画するため、 それぞれ +1。
    const countText = (label: string) =>
      (html.match(new RegExp(`>(?:🔒 )?${label}<`, 'g')) ?? []).length;
    expect(countText('初級')).toBe(3);   // preflop + flop + missed
    // ">中級<" = preflop の「中級」見出し + flop の未実装カード。
    expect(countText('中級')).toBe(2);
    expect(countText('上級')).toBe(3);   // preflop + flop + missed (未実装表記)
    expect(countText('超上級')).toBe(2); // preflop + flop
    // 一覧の中級グループは短縮ラベル (見出し「中級」配下)。
    expect(countText('総合問題')).toBe(1);
    expect(countText('EP\\(UTG,HJ\\)')).toBe(1);
    expect(countText('LP\\(CO,BTN\\)')).toBe(1);
    expect(countText('Blind\\(SB,BB\\)')).toBe(1);
    // 「中級 総合」「中級 EP」等の完全ラベルは間違えた問題セクションのみ。
    expect(countText('中級 総合')).toBe(1);
    expect(countText('中級 EP')).toBe(1);
    expect(countText('中級 LP')).toBe(1);
    expect(countText('中級 Blind')).toBe(1);
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

  it('未実装 level は「未実装」バッジ表示 (preflop 上級/超上級 + flop 全 6 + missed の上級 1 = 7 枚)', () => {
    // preflop_advanced / preflop_expert は implemented=false なので unlocked 判定より
    // 先に「未実装」ブランチに入る。中級のみがロック扱い (playable + !unlocked)。
    // MissedProblemsSection の「上級」カードにも「未実装」テキストが入る (+1)。
    const html = render();
    const matches = html.match(/>未実装</g) ?? [];
    expect(matches.length).toBe(7);
  });

  it('ロック中 level は "🔒" + ヒント文を表示 (中級: "初級で 20/20 取るとアンロック")', () => {
    const html = render();
    expect(html).toContain('🔒');
    expect(html).toContain('初級で 20/20 取るとアンロック');
  });

  it('解放済みレベル (初級) には [ルールを確認] [スタート] が常に表示', () => {
    const html = render();
    expect(html).toContain('>スタート<');
    expect(html).toContain('>ルールを確認<');
  });

  it('中級は「中級」見出し配下に短縮ラベルでネスト表示', () => {
    const html = render();
    expect(html).toContain('>中級<');           // サブ見出し
    expect(html).toContain('EP(UTG,HJ)');        // ポジション補足つき
    expect(html).toContain('Blind(SB,BB)');
  });

  it('一覧にソリューション条件 (スタック/レーキ/open額) を表示しない', () => {
    const html = render();
    expect(html).not.toContain('スタック: 100BB');
    expect(html).not.toContain('2.5BB open');
  });

  it('「← ホーム」リンク (AppHeader showBack)', () => {
    const html = render();
    expect(html).toContain('href="/"');
    expect(html).toContain('ホーム');
  });
});
