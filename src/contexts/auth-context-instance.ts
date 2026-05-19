// AuthContext の Context オブジェクトと型だけを切り出した非コンポーネントモジュール。
// react-refresh/only-export-components 規則を回避するため、Provider コンポーネントとは
// 別ファイルに置く。
//
// Provider 実装は ./AuthContext.tsx、hook は ../hooks/useAuth.ts を参照。

import { createContext } from 'react';
import type { AccountPublic } from '../api/auth';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

/**
 * 'kicked' = 他端末で同じアカウントが新規ログインしたためサーバー側でセッションを削除された。
 * 'idle'   = クライアント側で 5 分間ボタン操作がなく自動ログアウトされた。
 * null     = 通常の未ログイン状態。
 */
export type SignedOutReason = 'kicked' | 'idle' | null;

export interface AuthState {
  status: AuthStatus;
  account: AccountPublic | null;
  sessionId: string | null;
  signedOutReason: SignedOutReason;
  login: (args: { pokerName: string; privatePass: string; groupKey: string }) => Promise<void>;
  signup: (args: { pokerName: string; privatePass: string; groupKey: string }) => Promise<void>;
  /** reason='idle' で呼ぶと LoginGate に自動ログアウト案内が出る。 */
  logout: (reason?: Exclude<SignedOutReason, null>) => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
