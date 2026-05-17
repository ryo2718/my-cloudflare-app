// POST /api/auth/signup
//   Body: { poker_name, private_pass, group_key }
//   Response 200: { session_id, account: {...} }
//   Response 400 / 401:
//     - invalid_payload      ... 形式不正
//     - invalid_group_key    ... group_key 不一致
//     - name_taken           ... poker_name 既存
//
// 仕様:
//  - group_key 検証 (login と同じく現在 active を constant-time 比較)
//  - poker_name の一意性チェック
//  - is_admin = false で新規作成 (admin 昇格は手動 SQL で行う前提)
//  - 作成後は自動ログインさせて session を発行

import {
  constantTimeEqual,
  jsonResponse,
  toAccountPublic,
} from '../../lib/auth';
import {
  createSession,
  findAccountById,
  findAccountByName,
  findActiveGroupKey,
  insertAccount,
  touchLastLogin,
} from '../../lib/db';
import { SESSION_DURATION_MS, type AuthSuccess, type Env } from '../../lib/types';

interface SignupBody {
  poker_name?: unknown;
  private_pass?: unknown;
  group_key?: unknown;
}

const POKER_NAME_MAX = 32;
const PRIVATE_PASS_MAX = 128;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return jsonResponse(400, { error: 'invalid_payload' });
  }

  const pokerName = body.poker_name;
  const privatePass = body.private_pass;
  const groupKey = body.group_key;
  if (
    typeof pokerName !== 'string' ||
    typeof privatePass !== 'string' ||
    typeof groupKey !== 'string' ||
    pokerName.length === 0 ||
    pokerName.length > POKER_NAME_MAX ||
    privatePass.length === 0 ||
    privatePass.length > PRIVATE_PASS_MAX ||
    groupKey.length === 0
  ) {
    return jsonResponse(400, { error: 'invalid_payload' });
  }

  // group_key 検証
  const activeKey = await findActiveGroupKey(env.DB);
  if (!activeKey || !constantTimeEqual(activeKey.key_value, groupKey)) {
    return jsonResponse(401, { error: 'invalid_group_key' });
  }

  // 名前重複チェック
  const existing = await findAccountByName(env.DB, pokerName);
  if (existing) {
    return jsonResponse(400, { error: 'name_taken' });
  }

  const newId = await insertAccount(env.DB, {
    pokerName,
    privatePass,
    isAdmin: false,
  });
  const account = await findAccountById(env.DB, newId);
  if (!account) {
    return jsonResponse(500, { error: 'account_creation_failed' });
  }

  const { id: sessionId } = await createSession(env.DB, {
    accountId: account.id,
    durationMs: SESSION_DURATION_MS,
  });
  await touchLastLogin(env.DB, account.id);

  const responseBody: AuthSuccess = {
    session_id: sessionId,
    account: toAccountPublic(account),
  };
  return jsonResponse(200, responseBody);
};
