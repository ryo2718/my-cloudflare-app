// @vitest-environment jsdom
// 間違えた問題セクション: プリフロップ/ポストフロップの2カテゴリを折りたたみ表示。
// 階級 (初級/中級) で統合され、各カテゴリ 2 エントリ (= 計 4) になっていること。

import { describe, it, expect } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { AuthContext, type AuthState } from '../../contexts/AuthContext';
import { MissedProblemsSection } from './MissedProblemsSection';

// sessionId=null で件数 fetch を発火させない (集計は別テスト範囲)。
function makeAuth(): AuthState {
  return {
    status: 'unauthenticated',
    account: null,
    sessionId: null,
    signedOutReason: null,
    login: async () => {},
    signup: async () => {},
    logout: async () => {},
  };
}

function renderSection() {
  return render(
    <AuthContext.Provider value={makeAuth()}>
      <MissedProblemsSection />
    </AuthContext.Provider>,
  );
}

describe('MissedProblemsSection (階級で統合)', () => {
  it('プリフロップ/ポストフロップ両カテゴリ + 各 初級/中級 の階級エントリを表示する', () => {
    const { container } = renderSection();
    expect(screen.getByText('プリフロップトレーニング')).toBeTruthy();
    expect(screen.getByText('ポストフロップトレーニング')).toBeTruthy();
    // 各カテゴリ 初級/中級 の 2 エントリ = 計 4 (個別モードタブは廃止)。
    expect(screen.getAllByText('初級').length).toBe(2);
    expect(screen.getAllByText('中級').length).toBe(2);
    // 階級プールの復習一覧へのリンク (tier キー)。
    expect(container.querySelector('a[href="/quiz/review/preflop/tier_pf_beginner"]')).toBeTruthy();
    expect(container.querySelector('a[href="/quiz/review/preflop/tier_pf_intermediate"]')).toBeTruthy();
    expect(container.querySelector('a[href="/quiz/review/flop/tier_flop_beginner"]')).toBeTruthy();
    expect(container.querySelector('a[href="/quiz/review/flop/tier_flop_intermediate"]')).toBeTruthy();
    // 個別モードタブは出さない (統合済み)。
    expect(screen.queryByText('レンジCB SRP')).toBeNull();
    expect(screen.queryByText('中級 総合')).toBeNull();
  });

  it('カテゴリ見出しのタップで折りたたみできる', async () => {
    const user = userEvent.setup();
    renderSection();
    expect(screen.getAllByText('初級').length).toBe(2);
    // ポストフロップの見出しボタンをタップ → 配下が閉じる (初級/中級が片方ぶん減る)。
    const toggle = screen.getByRole('button', { name: /ポストフロップトレーニング/ });
    await user.click(toggle);
    expect(screen.getAllByText('初級').length).toBe(1);
    expect(screen.getAllByText('中級').length).toBe(1);
  });
});
