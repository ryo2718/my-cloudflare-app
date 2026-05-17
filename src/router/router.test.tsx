import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link } from './router';
import { navigate } from './router-core';

// Mock minimal window for SSR-safe tests.
// useRoute() の subscription はクライアント runtime での挙動なのでここではテストせず、
// navigate / Link の static markup と URL 書き換え動作のみ検証。

interface FakeHistory {
  pushState: (s: unknown, t: string, u?: string) => void;
}

beforeEach(() => {
  const calls: string[] = [];
  const fakeWindow = {
    location: { pathname: '/' },
    history: {
      pushState: (_s: unknown, _t: string, u?: string) => {
        if (typeof u === 'string') {
          (fakeWindow.location as { pathname: string }).pathname = u;
        }
      },
    } as FakeHistory,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    _calls: calls,
  };
  vi.stubGlobal('window', fakeWindow);
  // Node 環境では PopStateEvent が未定義。最小 stub を global に置く。
  class FakePopStateEvent {
    type: string;
    constructor(type: string) { this.type = type; }
  }
  vi.stubGlobal('PopStateEvent', FakePopStateEvent);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('navigate', () => {
  it('pushState を呼び pathname が変わる', () => {
    expect((window as unknown as { location: { pathname: string } }).location.pathname).toBe('/');
    navigate('/strategy');
    expect((window as unknown as { location: { pathname: string } }).location.pathname).toBe('/strategy');
  });

  it('同じパスへの navigate は no-op (pushState 呼ばない)', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    navigate('/'); // すでに / にいる
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('<Link />', () => {
  it('href 属性に to がそのまま入る', () => {
    const html = renderToStaticMarkup(<Link to="/strategy">go</Link>);
    expect(html).toContain('href="/strategy"');
    expect(html).toContain('>go<');
  });

  it('子要素を反映', () => {
    const html = renderToStaticMarkup(
      <Link to="/admin">
        <span>admin-text</span>
      </Link>,
    );
    expect(html).toContain('admin-text');
  });
});
