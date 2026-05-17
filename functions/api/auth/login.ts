// POST /api/auth/login
//   Body: { poker_name, private_pass, group_key }
//   Response 200: { session_id, account: { id, poker_name, is_admin } }
//   Response 400 / 401: { error: '...' }
//
// 検証順:
//  1. 必須フィールド存在チェック
//  2. group_key が現在 active と一致
//  3. poker_name で account 検索
//  4. private_pass 一致 (constant-time)
//  5. session 作成 + last_login_at 更新

import {
  constantTimeEqual,
  jsonResponse,
  toAccountPublic,
} from '../../lib/auth';
import {
  createSession,
  findAccountByName,
  findActiveGroupKey,
  touchLastLogin,
} from '../../lib/db';
import { SESSION_DURATION_MS, type AuthSuccess, type Env } from '../../lib/types';

interface LoginBody {
  poker_name?: unknown;
  private_pass?: unknown;
  group_key?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
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
    privatePass.length === 0 ||
    groupKey.length === 0
  ) {
    return jsonResponse(400, { error: 'invalid_payload' });
  }

  // group_key 検証
  const activeKey = await findActiveGroupKey(env.DB);
  if (!activeKey || !constantTimeEqual(activeKey.key_value, groupKey)) {
    return jsonResponse(401, { error: 'invalid_group_key' });
  }

  // account 検索
  const account = await findAccountByName(env.DB, pokerName);
  if (!account || !constantTimeEqual(account.private_pass, privatePass)) {
    // 微小遅延 (失敗時の総当たり緩和)
    await new Promise((resolve) => setTimeout(resolve, 150));
    return jsonResponse(401, { error: 'invalid_credentials' });
  }

  // session 発行
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
