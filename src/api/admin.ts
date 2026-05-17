// /api/admin/* client (admin 画面用)。Bearer token は呼び出し時に渡す。
//
// 既存 src/api/auth.ts と独立。各関数はサーバから返ってきた error code を投げる
// (AuthApiError 同等) ので、画面側はメッセージマッピングを担当する。

import { AuthApiError } from './auth';

export interface AccountAdmin {
  id: number;
  poker_name: string;
  private_pass: string;
  is_admin: boolean;
  created_at: number;
  last_login_at: number | null;
  /** training_results.best_score の合計 (Phase 9 で追加)。 */
  total_points: number;
}

export interface GroupKey {
  id: number;
  key_value: string;
  active_from: number;
  active_until: number | null;
  created_at: number;
}

interface ErrorBody {
  error?: string;
}

async function fetchJsonAuthed<T>(
  url: string,
  sessionId: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${sessionId}`,
    },
  });
  if (res.ok) return (await res.json()) as T;
  let code: string | undefined;
  try {
    const body = (await res.json()) as ErrorBody;
    code = typeof body.error === 'string' ? body.error : undefined;
  } catch {
    // ignore
  }
  throw new AuthApiError(code ?? `http_${res.status}`, res.status);
}

export async function apiAdminListAccounts(
  sessionId: string,
): Promise<AccountAdmin[]> {
  const res = await fetchJsonAuthed<{ accounts: AccountAdmin[] }>(
    '/api/admin/accounts',
    sessionId,
  );
  return res.accounts;
}

export async function apiAdminListGroupKeys(
  sessionId: string,
): Promise<GroupKey[]> {
  const res = await fetchJsonAuthed<{ group_keys: GroupKey[] }>(
    '/api/admin/group_keys',
    sessionId,
  );
  return res.group_keys;
}

export async function apiAdminRotateGroupKey(
  sessionId: string,
  newKey: string,
): Promise<{ active_from: number; key_value: string }> {
  return await fetchJsonAuthed<{ active_from: number; key_value: string }>(
    '/api/admin/group_key',
    sessionId,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_key: newKey }),
    },
  );
}
