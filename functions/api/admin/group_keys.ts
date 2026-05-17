// GET /api/admin/group_keys
//   Header: Authorization: Bearer <admin session>
//   Response 200: { group_keys: GroupKeyRow[] }  (新しい順)
//
// Phase D で履歴表示 UI に使う。

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import type { Env, GroupKeyRow } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await resolveAccountFromRequest(env.DB, request);
  if (!me || me.is_admin !== 1) {
    return jsonResponse(403, { error: 'forbidden' });
  }
  const res = await env.DB
    .prepare('SELECT * FROM group_keys ORDER BY active_from DESC')
    .all<GroupKeyRow>();
  return jsonResponse(200, { group_keys: res.results ?? [] });
};
