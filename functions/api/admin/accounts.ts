// GET /api/admin/accounts
//   Header: Authorization: Bearer <admin session>
//   Response 200: { accounts: AccountAdmin[] }
//   (middleware が 401/403 を返した後にここに来るので、認証チェックは念のため再度。)

import { jsonResponse, resolveAccountFromRequest } from '../../lib/auth';
import { listAccounts } from '../../lib/db';
import type { AccountAdmin, Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await resolveAccountFromRequest(env.DB, request);
  if (!me || me.is_admin !== 1) {
    return jsonResponse(403, { error: 'forbidden' });
  }

  const rows = await listAccounts(env.DB);
  const accounts: AccountAdmin[] = rows.map((r) => ({
    id: r.id,
    poker_name: r.poker_name,
    private_pass: r.private_pass, // 平文 (運営閲覧用、身内要件)
    is_admin: r.is_admin === 1,
    created_at: r.created_at,
    last_login_at: r.last_login_at,
  }));
  return jsonResponse(200, { accounts });
};
