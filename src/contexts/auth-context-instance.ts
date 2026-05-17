// AuthContext の Context オブジェクトと型だけを切り出した非コンポーネントモジュール。
// react-refresh/only-export-components 規則を回避するため、Provider コンポーネントとは
// 別ファイルに置く。
//
// Provider 実装は ./AuthContext.tsx、hook は ../hooks/useAuth.ts を参照。

import { createContext } from 'react';
import type { AccountPublic } from '../api/auth';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

export interface AuthState {
  status: AuthStatus;
  account: AccountPublic | null;
  sessionId: string | null;
  login: (args: { pokerName: string; privatePass: string; groupKey: string }) => Promise<void>;
  signup: (args: { pokerName: string; privatePass: string; groupKey: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
