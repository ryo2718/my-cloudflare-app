// AuthContext の薄いラッパー hook。Provider 外で呼ばれたら throw。

import { useContext } from 'react';
import { AuthContext, type AuthState } from '../contexts/AuthContext';

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
