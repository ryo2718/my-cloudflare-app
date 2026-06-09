// @vitest-environment jsdom
// 間違えた問題セクション: プリフロップ/ポストフロップの2カテゴリを折りたたみ表示。
// ポストフロップ (レンジCB / レンジドンク・BMCB) を追加しつつ、既存のプリフロップが壊れないこと。

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

describe('MissedProblemsSection', () => {
  it('プリフロップ/ポストフロップ両カテゴリと各モードを表示する', () => {
    renderSection();
    // 2 カテゴリ見出し。
    expect(screen.getByText('プリフロップトレーニング')).toBeTruthy();
    expect(screen.getByText('ポストフロップトレーニング')).toBeTruthy();
    // プリフロップの既存モード (壊れていない)。
    expect(screen.getByText('中級 総合')).toBeTruthy();
    // ポストフロップ 3 モード。
    expect(screen.getByText('レンジCB SRP')).toBeTruthy();
    expect(screen.getByText('レンジCB 3BP/4BP/5BP')).toBeTruthy();
    expect(screen.getByText('レンジドンク/BMCB')).toBeTruthy();
    // 件数収集が無いので「(間違えた問題なし)」表示 (3件)。
    expect(screen.getAllByText('(間違えた問題なし)').length).toBeGreaterThanOrEqual(3);
  });

  it('カテゴリ見出しのタップで折りたたみできる', async () => {
    const user = userEvent.setup();
    renderSection();
    expect(screen.getByText('レンジCB SRP')).toBeTruthy();
    // ポストフロップの見出しボタンをタップ → 配下が閉じる。
    const toggle = screen.getByRole('button', { name: /ポストフロップトレーニング/ });
    await user.click(toggle);
    expect(screen.queryByText('レンジCB SRP')).toBeNull();
    // プリフロップ側は開いたまま。
    expect(screen.getByText('中級 総合')).toBeTruthy();
  });
});
