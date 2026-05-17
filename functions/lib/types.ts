// D1 row 型 + API レスポンス型。
//
// 注: D1 の boolean は INTEGER (0/1) で来るため、accounts.is_admin は number 型。
// クライアントへ返す時は boolean に変換する (AccountResponse 経由)。

export interface AccountRow {
  id: number;
  poker_name: string;
  private_pass: string;
  is_admin: number; // 0 or 1
  created_at: number;
  last_login_at: number | null;
}

export interface SessionRow {
  id: string;
  account_id: number;
  created_at: number;
  expires_at: number;
}

export interface GroupKeyRow {
  id: number;
  key_value: string;
  active_from: number;
  active_until: number | null;
  created_at: number;
}

/** クライアント (フロント) に返す account の最小情報 (private_pass は含めない)。 */
export interface AccountPublic {
  id: number;
  poker_name: string;
  is_admin: boolean;
}

/** Admin 画面用 (平文 private_pass + last_login_at を含む)。 */
export interface AccountAdmin {
  id: number;
  poker_name: string;
  private_pass: string;
  is_admin: boolean;
  created_at: number;
  last_login_at: number | null;
}

export interface AuthSuccess {
  session_id: string;
  account: AccountPublic;
}

export interface Env {
  DB: D1Database;
}

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 日
