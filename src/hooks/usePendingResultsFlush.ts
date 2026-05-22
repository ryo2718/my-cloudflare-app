// 認証済みになったとき、退避済みの成績スコア (保存失敗分) を再送する hook。
// 再ログイン後の自動復旧経路。点数は冪等 (best_score=max) のため再送しても二重加算しない。
// 1 件でも失敗したら以降は中断 (失効中の可能性が高いので次回認証時に再試行)。

import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { apiSubmitTrainingResult } from '../api/account';
import { loadPendingResults, clearPendingResult } from '../data/training/pendingResults';

export function usePendingResultsFlush(): void {
  const auth = useAuth();
  const status = auth.status;
  const sessionId = auth.sessionId;
  const flushingRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !sessionId) return;
    if (flushingRef.current) return;
    const pending = loadPendingResults();
    if (pending.length === 0) return;

    flushingRef.current = true;
    let cancelled = false;
    void (async () => {
      for (const p of pending) {
        if (cancelled) break;
        try {
          await apiSubmitTrainingResult(sessionId, { training_type: p.training_type, score: p.score });
          clearPendingResult(p.training_type);
        } catch {
          break; // 失効中など。残りは次回認証時に再試行。
        }
      }
      flushingRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [status, sessionId]);
}
