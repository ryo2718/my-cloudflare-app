// POST /api/auth/logout
//   Header: Authorization: Bearer <session_id>
//   Response 200: { ok: true }
//
// session を D1 から DELETE。token 自体は jwt 風ではなく D1 主体なので、
// DELETE すれば即時失効 (verify が走らない、active 検索が miss するため)。
// 不正 / 未認証時もエラーにせず ok: true (LocalStorage クリアの保険動作と整合)。

import { extractBearerToken, jsonResponse } from '../../lib/auth';
import { deleteSession } from '../../lib/db';
import type { Env } from '../../lib/types';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = extractBearerToken(request.headers.get('Authorization'));
  if (token) {
    await deleteSession(env.DB, token);
  }
  return jsonResponse(200, { ok: true });
};
