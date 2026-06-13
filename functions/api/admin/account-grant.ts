// POST /api/admin/account-grant
//   Header: Authorization: Bearer <admin session>
//   Body:
//     { id: number, type: 'tester', value: boolean }        テスター登録 on/off (無期限免除)
//     { id: number, type: 'vip', days: number }             VIP 付与 (vip_until = now + days*日)
//     { id: number, type: 'vip', days: null }               VIP 解除 (vip_until = NULL)
//   Response 200: { account: { id, poker_name, tester, vip_until } }
//   Response 400 invalid_payload / 403 forbidden / 404 not_found
//
// admin 必須 (group_key.ts と同じ is_admin チェック)。

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import { findAccountById } from '../../lib/db';
import type { Env } from '../../lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_VIP_DAYS = 365;

interface Body {
  id?: unknown;
  type?: unknown;
  value?: unknown;
  days?: unknown;
}

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

  const id = body.id;
  const type = body.type;
  if (typeof id !== 'number' || !Number.isInteger(id) || (type !== 'tester' && type !== 'vip')) {
    return jsonResponse(400, { error: 'invalid_payload' });
  }

  const target = await findAccountById(env.DB, id);
  if (!target) {
    return jsonResponse(404, { error: 'not_found' });
  }

  if (type === 'tester') {
    if (typeof body.value !== 'boolean') {
      return jsonResponse(400, { error: 'invalid_payload' });
    }
    await env.DB
      .prepare('UPDATE accounts SET tester = ? WHERE id = ?')
      .bind(body.value ? 1 : 0, id)
      .run();
  } else {
    // type === 'vip'
    const days = body.days;
    if (days === null || days === undefined) {
      await env.DB.prepare('UPDATE accounts SET vip_until = NULL WHERE id = ?').bind(id).run();
    } else {
      if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > MAX_VIP_DAYS) {
        return jsonResponse(400, { error: 'invalid_payload' });
      }
      const until = Date.now() + days * DAY_MS;
      await env.DB.prepare('UPDATE accounts SET vip_until = ? WHERE id = ?').bind(until, id).run();
    }
  }

  const updated = await findAccountById(env.DB, id);
  return jsonResponse(200, {
    account: {
      id: updated!.id,
      poker_name: updated!.poker_name,
      tester: updated!.tester === 1,
      vip_until: updated!.vip_until,
    },
  });
};
