// 保存済みアカウントの LocalStorage 永続化。身内向け仕様により private_pass は平文保存。
//
// ⚠ セキュリティ注記 (身内向け仕様、ユーザー承認済み):
//   - 平文パスワードを端末に保存する。共有端末や紛失リスクは運用で対処。
//   - 同 LocalStorage には session_id (Bearer token) も別 key で保存される。
//
// LocalStorage key: "pokergto.saved_accounts" (v1)
// 失敗系 (private browsing, QuotaExceeded 等) は silently ignore。

const STORAGE_KEY = 'pokergto.saved_accounts';
const STORAGE_VERSION = 1;

export interface SavedAccount {
  poker_name: string;
  /** 平文 (身内向け仕様)。 */
  private_pass: string;
  /** 最終使用日時 unix ms。 */
  last_used_at: number;
  /** 肩書きラベル用 (ログイン成功時にサーバ値で更新)。旧保存分は未設定。 */
  is_admin?: boolean;
  tester?: boolean;
  vip_until?: number | null;
}

/** saveAccount で保存する肩書き情報 (ログインレスポンス由来)。 */
export interface SavedAccountMeta {
  is_admin?: boolean;
  tester?: boolean;
  vip_until?: number | null;
}

export type SavedAccountsMap = Record<string, SavedAccount>;

interface StoredShape {
  version: number;
  entries: SavedAccountsMap;
}

function readStorage(): SavedAccountsMap {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredShape;
    if (parsed.version !== STORAGE_VERSION || !parsed.entries) return {};
    return parsed.entries;
  } catch {
    return {};
  }
}

function writeStorage(entries: SavedAccountsMap): void {
  try {
    if (!globalThis.localStorage) return;
    const payload: StoredShape = { version: STORAGE_VERSION, entries };
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // QuotaExceeded / SecurityError 等は silent fail
  }
}

/** 全保存アカウントを取得 (last_used_at 降順、新しいものが先頭)。 */
export function getSavedAccounts(): SavedAccount[] {
  const entries = readStorage();
  return Object.values(entries).sort((a, b) => b.last_used_at - a.last_used_at);
}

/**
 * アカウントを保存 or 更新 (key は poker_name、同名は private_pass を最新で上書き、
 * last_used_at は常に now で更新)。
 *
 * 入力が空文字なら no-op。
 */
export function saveAccount(
  pokerName: string,
  privatePass: string,
  meta?: SavedAccountMeta,
): void {
  if (!pokerName || !privatePass) return;
  const entries = readStorage();
  entries[pokerName] = {
    poker_name: pokerName,
    private_pass: privatePass,
    last_used_at: Date.now(),
    is_admin: meta?.is_admin,
    tester: meta?.tester,
    vip_until: meta?.vip_until ?? null,
  };
  writeStorage(entries);
}

/** 指定 poker_name のエントリを削除。存在しなければ no-op。 */
export function deleteSavedAccount(pokerName: string): void {
  const entries = readStorage();
  if (!(pokerName in entries)) return;
  delete entries[pokerName];
  writeStorage(entries);
}

/** 全削除 (デバッグ・ログアウト連動などで使う)。 */
export function clearSavedAccounts(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// テスト専用
export const _internals = {
  STORAGE_KEY,
  STORAGE_VERSION,
  readStorage,
  writeStorage,
};
