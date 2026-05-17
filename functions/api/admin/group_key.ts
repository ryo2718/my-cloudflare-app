// POST /api/admin/group_key
//   Header: Authorization: Bearer <admin session>
//   Body: { new_key: string }
//   Response 200: { active_from, key_value }
//   Response 400: { error: 'invalid_payload' }
//
// 既存 active row に active_until を入れて、新 row を INSERT (lib/db.ts:rotateGroupKey)。

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import { rotateGroupKey } from '../../lib/db';
import type { Env } from '../../lib/types';

interface Body {
  new_key?: unknown;
}

const KEY_MIN = 1;
const KEY_MAX = 64;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const me = await resolveAccountFromRequest(env.DB, request);
  if (!me || me.is_admin !== 1) {
    return jsonResponse(403, { error: 'forbidden' });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonResponse(400, { error: 'invalid_payload' });
  }
  const newKey = body.new_key;
  if (
    typeof newKey !== 'string' ||
    newKey.length < KEY_MIN ||
    newKey.length > KEY_MAX
  ) {
    return jsonResponse(400, { error: 'invalid_payload' });
  }

  const row = await rotateGroupKey(env.DB, newKey);
  return jsonResponse(200, {
    active_from: row.active_from,
    key_value: row.key_value,
  });
};
