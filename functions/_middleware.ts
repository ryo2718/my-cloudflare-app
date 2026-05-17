// Phase B 改訂: site-wide auth gate を撤去。
//
// 新方針:
//   - 静的 asset / HTML は全公開 (SPA 側の <LoginGate> が認証フローを担う)
//   - `/api/admin/*` だけ middleware で admin 認証を要求
//   - その他の `/api/*` 認証要件は各 endpoint 内で処理 (例: /api/auth/me)
//
// LocalStorage の session_id を Authorization: Bearer で送るので、HttpOnly cookie
// は不使用。HMAC 署名 cookie の旧実装は削除済 (functions/lib/auth.ts 新版参照)。

import { jsonResponse, resolveAccountFromRequest } from './lib/auth';
import type { Env } from './lib/types';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // /api/admin/* のみゲート (admin only)
  if (url.pathname.startsWith('/api/admin/')) {
    const account = await resolveAccountFromRequest(env.DB, request);
    if (!account) {
      return jsonResponse(401, { error: 'unauthorized' });
    }
    if (account.is_admin !== 1) {
      return jsonResponse(403, { error: 'forbidden' });
    }
    // 認証成功: context.data 経由で endpoint に渡したいが、Pages Functions の
    // data 共有は型サポートが薄いため、各 endpoint で再度 resolveAccountFromRequest を呼ぶ。
    // (D1 round-trip 1 回追加だが、admin endpoints は呼び出し頻度低く問題なし)。
  }

  return next();
};
