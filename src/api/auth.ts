// /api/auth/* client。Pages Functions と同一オリジンなので fetch は相対パスで OK。
//
// LocalStorage キー命名:
//   - "pokergto.session_id"   ... server から発行された session ID (Bearer token)
//
// Bearer token 送信は呼び出し側 (AuthContext) が responsibility。本モジュールは
// 純粋な fetch wrapper として、URL/Body/エラー処理だけ責務を持つ。

export interface AccountPublic {
  id: number;
  poker_name: string;
  is_admin: boolean;
  /** ranking 除外フラグ。true なら通常ランキングに出さず参考枠に表示。 */
  is_ranking_excluded: boolean;
}

export interface AuthSuccess {
  session_id: string;
  account: AccountPublic;
}

export class AuthApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(`auth API error: ${code} (${status})`);
    this.code = code;
    this.status = status;
  }
}

interface ErrorBody {
  error?: string;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }
  let bodyCode: string | undefined;
  try {
    const body = (await res.json()) as ErrorBody;
    bodyCode = typeof body.error === 'string' ? body.error : undefined;
  } catch {
    // ignore
  }
  throw new AuthApiError(bodyCode ?? `http_${res.status}`, res.status);
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function apiLogin(args: {
  pokerName: string;
  privatePass: string;
  groupKey: string;
}): Promise<AuthSuccess> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      poker_name: args.pokerName,
      private_pass: args.privatePass,
      group_key: args.groupKey,
    }),
  });
  return parseJsonOrThrow<AuthSuccess>(res);
}

export async function apiSignup(args: {
  pokerName: string;
  privatePass: string;
  groupKey: string;
}): Promise<AuthSuccess> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      poker_name: args.pokerName,
      private_pass: args.privatePass,
      group_key: args.groupKey,
    }),
  });
  return parseJsonOrThrow<AuthSuccess>(res);
}

export async function apiMe(sessionId: string): Promise<{ account: AccountPublic }> {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  return parseJsonOrThrow<{ account: AccountPublic }>(res);
}

export async function apiLogout(sessionId: string): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  // server エラーでも client 側は強制ログアウトしたいので throw しない
}
