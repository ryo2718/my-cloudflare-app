import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider, AuthContext, type AuthState } from './AuthContext';
import { useContext } from 'react';

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

/** ProviderからContextの初期値を取り出すヘルパー (renderToStaticMarkupは useEffect が走らない前提)。 */
function Capture({ onCapture }: { onCapture: (s: AuthState) => void }) {
  const ctx = useContext(AuthContext);
  if (ctx) onCapture(ctx);
  return null;
}

describe('AuthProvider — 初期マウント', () => {
  it('LocalStorage に session_id が無い → unauthenticated は server-side では loading のままだが、Provider 値が取得できる', () => {
    let captured: AuthState | null = null;
    renderToStaticMarkup(
      <AuthProvider>
        <Capture onCapture={(s) => { captured = s; }} />
      </AuthProvider>,
    );
    // useEffect は server-side では走らないので status='loading' のまま。
    expect(captured).not.toBeNull();
    expect(captured!.status).toBe('loading');
    expect(captured!.account).toBeNull();
    expect(captured!.sessionId).toBeNull();
    expect(captured!.signedOutReason).toBeNull();
    // API surface (関数群) は揃っている
    expect(typeof captured!.login).toBe('function');
    expect(typeof captured!.signup).toBe('function');
    expect(typeof captured!.logout).toBe('function');
  });
});

describe('AuthContext — context outside provider', () => {
  it('useContext で null が返る (Provider なし、render テスト)', () => {
    let captured: unknown = 'unset';
    renderToStaticMarkup(<Capture onCapture={(s) => { captured = s; }} />);
    // Provider 外なので useContext は default value (null) を返し、onCapture は呼ばれない。
    expect(captured).toBe('unset');
  });
});
