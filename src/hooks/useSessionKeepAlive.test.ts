// @vitest-environment jsdom
// useSessionKeepAlive: プレイ中、操作連動で最大 intervalMs に 1 回だけ ping すること。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import '../test/ui';

vi.mock('./useAuth', () => ({
  useAuth: () => ({ status: 'authenticated', sessionId: 'sid', account: null, signedOutReason: null, login: vi.fn(), signup: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../api/session', () => ({ apiSessionPing: vi.fn(async () => {}) }));

import { apiSessionPing } from '../api/session';
import { useSessionKeepAlive, KEEPALIVE_INTERVAL_MS } from './useSessionKeepAlive';

beforeEach(() => {
  vi.mocked(apiSessionPing).mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
});

function fireActivity() {
  window.dispatchEvent(new Event('pointerdown'));
}

describe('useSessionKeepAlive', () => {
  it('入場直後の操作では ping しない (基準が now)', () => {
    renderHook(() => useSessionKeepAlive());
    fireActivity();
    expect(apiSessionPing).not.toHaveBeenCalled();
  });

  it('interval 経過後の操作で 1 回 ping し、直後の連続操作は throttle される', () => {
    renderHook(() => useSessionKeepAlive());
    vi.setSystemTime(KEEPALIVE_INTERVAL_MS);
    fireActivity();
    expect(apiSessionPing).toHaveBeenCalledTimes(1);
    expect(apiSessionPing).toHaveBeenCalledWith('sid');
    // 直後にもう一度操作 → interval 未経過なので ping しない
    fireActivity();
    expect(apiSessionPing).toHaveBeenCalledTimes(1);
    // さらに interval 経過後の操作で 2 回目
    vi.setSystemTime(KEEPALIVE_INTERVAL_MS * 2);
    fireActivity();
    expect(apiSessionPing).toHaveBeenCalledTimes(2);
  });

  it('放置 (操作なし) では ping しない', () => {
    renderHook(() => useSessionKeepAlive());
    vi.setSystemTime(KEEPALIVE_INTERVAL_MS * 3);
    // イベントを発火しない
    expect(apiSessionPing).not.toHaveBeenCalled();
  });
});
