// 認証 Provider。Context オブジェクトは ./auth-context-instance.ts に分離 (react-refresh)。
//
// ライフサイクル:
//   1. マウント: LocalStorage から session_id 取得 → /api/auth/me で検証
//   2. login()/signup(): API 叩く → 成功なら LocalStorage に保存 + 状態更新
//   3. logout(): API 叩く (best effort) → LocalStorage クリア + 状態更新

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiSignup,
  type AccountPublic,
} from '../api/auth';
import { saveAccount } from '../data/savedAccounts';
import {
  AuthContext,
  type AuthState,
  type AuthStatus,
} from './auth-context-instance';

// 再 export (既存 import パスの互換維持: 'AuthContext', 'AuthState', 'AuthStatus')
export { AuthContext };
export type { AuthState, AuthStatus };

const STORAGE_KEY = 'pokergto.session_id';

function readStoredSessionId(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStoredSessionId(id: string | null): void {
  try {
    if (!globalThis.localStorage) return;
    if (id === null) {
      globalThis.localStorage.removeItem(STORAGE_KEY);
    } else {
      globalThis.localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    // ignore (SecurityError / QuotaExceeded 等)
  }
}

interface ProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: ProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [account, setAccount] = useState<AccountPublic | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 初期化: LocalStorage から session 取り出して /api/auth/me で検証
  useEffect(() => {
    let cancelled = false;
    const id = readStoredSessionId();
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('unauthenticated');
      return;
    }

    apiMe(id)
      .then((res) => {
        if (cancelled) return;
        setSessionId(id);
        setAccount(res.account);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        writeStoredSessionId(null);
        setSessionId(null);
        setAccount(null);
        setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (args: { pokerName: string; privatePass: string; groupKey: string }) => {
      const result = await apiLogin(args);
      writeStoredSessionId(result.session_id);
      // 成功時に SavedAccount にも登録 (last_used_at 更新 or 新規追加)。
      // group_key は意図的に保存しない (毎回入力させる)。
      saveAccount(args.pokerName, args.privatePass);
      setSessionId(result.session_id);
      setAccount(result.account);
      setStatus('authenticated');
    },
    [],
  );

  const signup = useCallback(
    async (args: { pokerName: string; privatePass: string; groupKey: string }) => {
      const result = await apiSignup(args);
      writeStoredSessionId(result.session_id);
      // signup 直後にもログインと同様 SavedAccount に追加。
      saveAccount(args.pokerName, args.privatePass);
      setSessionId(result.session_id);
      setAccount(result.account);
      setStatus('authenticated');
    },
    [],
  );

  const logout = useCallback(async () => {
    const currentId = sessionId ?? readStoredSessionId();
    if (currentId) {
      await apiLogout(currentId);
    }
    writeStoredSessionId(null);
    setSessionId(null);
    setAccount(null);
    setStatus('unauthenticated');
  }, [sessionId]);

  const value = useMemo<AuthState>(
    () => ({ status, account, sessionId, login, signup, logout }),
    [status, account, sessionId, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
