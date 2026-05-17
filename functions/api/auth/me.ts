// GET /api/auth/me
//   Header: Authorization: Bearer <session_id>
//   Response 200: { account: { id, poker_name, is_admin } }
//   Response 401: { error: 'unauthorized' }
//
// 用途: SPA 起動時に LocalStorage の session_id を検証して再ログイン判定。

import { jsonResponse, resolveAccountFromRequest, toAccountPublic } from '../../lib/auth';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const account = await resolveAccountFromRequest(env.DB, request);
  if (!account) {
    return jsonResponse(401, { error: 'unauthorized' });
  }
  return jsonResponse(200, { account: toAccountPublic(account) });
};
