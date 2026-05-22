// トレーニングのプレイ中だけサーバセッションを延命する hook。
//
// 背景: サーバセッションは 5 分アイドルで失効する (last_accessed_at は認証 API 成功時のみ更新)。
// プレイ中は認証 API を呼ばない (出題は静的 JSON) ため、長いプレイ (即時フィードバック等) で
// セッションが失効し、結果画面の成績保存が 401 で失敗する。
//
// 対策: ユーザー操作 (タップ/クリック/キー = useIdleLogout と同じ「活動」) を検知し、
// 最大 KEEPALIVE_INTERVAL_MS に 1 回だけ /api/session/ping を打って延命する。
//   - 操作が無い (放置) 間は ping しない → useIdleLogout(5分) でログアウト = 放置は延命しない。
//   - 操作があれば 3 分ごとに延命 → サーバ 5 分アイドルに確実に間に合う (長考 1 問でも操作で延命)。

import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { apiSessionPing } from '../api/session';

export const KEEPALIVE_INTERVAL_MS = 3 * 60 * 1000;

const ACTIVITY_EVENTS: ReadonlyArray<keyof WindowEventMap> = [
  'pointerdown',
  'click',
  'touchstart',
  'keydown',
];

/** プレイ画面マウント中に呼ぶ。認証済みのときのみ活動連動で延命 ping する。 */
export function useSessionKeepAlive(intervalMs: number = KEEPALIVE_INTERVAL_MS): void {
  const auth = useAuth();
  const status = auth.status;
  const sessionId = auth.sessionId;
  const lastPingRef = useRef(0);

  useEffect(() => {
    if (status !== 'authenticated' || !sessionId) return;
    if (typeof window === 'undefined') return;

    // 入場直前に認証 API (一覧/確認画面) が走っておりセッションは新鮮。基準を now にして
    // 最初の ping は活動が intervalMs 続いた後に打つ。
    lastPingRef.current = Date.now();

    const onActivity = () => {
      const now = Date.now();
      if (now - lastPingRef.current < intervalMs) return;
      lastPingRef.current = now;
      void apiSessionPing(sessionId).catch(() => {
        // 失効時は useIdleLogout / 結果画面の退避・再送で対処する。ここでは握りつぶす。
      });
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
    };
  }, [status, sessionId, intervalMs]);
}
