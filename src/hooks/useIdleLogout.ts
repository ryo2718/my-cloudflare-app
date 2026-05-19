// 認証済み中だけ無操作タイマーを走らせて、 一定時間ボタン操作がなければ auth.logout('idle') する hook。
//
// 監視イベント:
//   - pointerdown / click / touchstart (タップ / クリック相当)
//   - keydown (キー入力、 フォーム入力等)
//
// スクロール / マウス移動はカウントしない (放置中でも自然に動く可能性があるため)。
//
// 認証されていない (status !== 'authenticated') 間はタイマーを張らない。
// LoginGate に「長時間操作がなかったため自動ログアウトしました」が出るのは
// auth.signedOutReason === 'idle' の時のみ。

import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const RESET_EVENTS: ReadonlyArray<keyof WindowEventMap> = [
  'pointerdown',
  'click',
  'touchstart',
  'keydown',
];

export function useIdleLogout(timeoutMs: number = IDLE_TIMEOUT_MS): void {
  const auth = useAuth();
  const status = auth.status;
  const logout = auth.logout;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (typeof window === 'undefined') return;

    const clear = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const armed = { current: false };
    const start = () => {
      clear();
      timerRef.current = window.setTimeout(() => {
        if (armed.current) return;
        armed.current = true;
        void logout('idle');
      }, timeoutMs);
    };

    const onActivity = () => {
      if (armed.current) return;
      start();
    };

    for (const ev of RESET_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    start();

    return () => {
      clear();
      for (const ev of RESET_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
    };
  }, [status, logout, timeoutMs]);
}
