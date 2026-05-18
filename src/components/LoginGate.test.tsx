import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginGate } from './LoginGate';
import { AuthContext, type AuthState } from '../contexts/AuthContext';
import { saveAccount, clearSavedAccounts } from '../data/savedAccounts';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
  clearSavedAccounts();
});
afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

function makeAuth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    status: 'unauthenticated',
    account: null,
    sessionId: null,
    signedOutReason: null,
    login: async () => {},
    signup: async () => {},
    logout: async () => {},
    ...overrides,
  };
}

function render(authState: AuthState, children: React.ReactNode = null): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={authState}>
      <LoginGate>{children}</LoginGate>
    </AuthContext.Provider>,
  );
}

describe('<LoginGate /> status', () => {
  it('loading: 読み込み中… のメッセージ表示', () => {
    const html = render(makeAuth({ status: 'loading' }));
    expect(html).toContain('読み込み中');
  });

  it('authenticated: children をそのまま render', () => {
    const html = render(
      makeAuth({ status: 'authenticated', account: { id: 1, poker_name: 'a', is_admin: false, is_ranking_excluded: false } }),
      <div>app-content</div>,
    );
    expect(html).toContain('app-content');
    expect(html).not.toContain('ログイン');
  });

  it('未認証時: children は出さない', () => {
    const html = render(makeAuth({ status: 'unauthenticated' }), <div>secret-app</div>);
    expect(html).not.toContain('secret-app');
  });
});

describe('<LoginGate /> タブ構成 (保存済み 0 件)', () => {
  it('「ログイン」+「新規アカウント」タブが見える、「保存済み」タブは出ない', () => {
    const html = render(makeAuth());
    expect(html).toContain('ログイン');
    expect(html).toContain('新規アカウント');
    expect(html).not.toContain('保存済み');
  });

  it('デフォルトで login タブ → poker_name/password 入力フォーム', () => {
    const html = render(makeAuth());
    expect(html).toContain('ポーカーネーム');
    expect(html).toContain('個人パスワード');
    expect(html).toContain('グループキー');
  });
});

describe('<LoginGate /> タブ構成 (保存済み >=1 件)', () => {
  beforeEach(async () => {
    saveAccount('テスト君', 'test');
    // last_used_at が同 ms にならないよう微小待ち
    await new Promise((r) => setTimeout(r, 3));
    saveAccount('ryoji', 'rj-pass');
  });

  it('「保存済み」タブが見える、デフォルトで選択', () => {
    const html = render(makeAuth());
    expect(html).toContain('保存済み');
    // 保存済みタブのアクティブ表示 + 「アカウントを選択」見出し
    expect(html).toContain('アカウントを選択');
    expect(html).toContain('テスト君');
    expect(html).toContain('ryoji');
  });

  it('Group Key 入力欄 + 「別のアカウントでログイン」リンク', () => {
    const html = render(makeAuth());
    expect(html).toContain('Group Key');
    expect(html).toContain('別のアカウントでログイン');
  });

  it('保存済みカードに「ログイン」と「削除」ボタンが含まれる', () => {
    const html = render(makeAuth());
    // ログインボタン (タブ名 'ログイン' と重複検出回避のため textContent はゆるく確認)
    expect(html).toContain('>ログイン<');
    expect(html).toContain('>削除<');
  });

  it('保存済みカードの並び順は last_used_at 降順 (ryoji が後で保存されたので先頭)', () => {
    const html = render(makeAuth());
    const idxRyoji = html.indexOf('ryoji');
    const idxTest = html.indexOf('テスト君');
    expect(idxRyoji).toBeGreaterThanOrEqual(0);
    expect(idxTest).toBeGreaterThanOrEqual(0);
    expect(idxRyoji).toBeLessThan(idxTest);
  });
});
