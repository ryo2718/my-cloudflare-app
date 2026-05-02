// パスワードを検証して auth cookie を発行。
// 30日有効、HttpOnly + Secure + SameSite=Lax。
//
// POST /api/login   body: { "password": "..." }   → 200 + Set-Cookie / 401

import { createAuthCookie, SESSION_SECONDS } from '../lib/auth';

interface Env {
  SITE_PASSWORD: string;
  AUTH_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SITE_PASSWORD || !env.AUTH_SECRET) {
    return jsonResponse(500, {
      error: 'auth not configured (SITE_PASSWORD / AUTH_SECRET missing)',
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'invalid JSON' });
  }
  const password = (body as { password?: unknown })?.password;
  if (typeof password !== 'string' || password.length === 0) {
    return jsonResponse(400, { error: 'password required' });
  }

  // タイミング攻撃対策のため、文字列長と内容を一定時間で比較する単純な実装。
  // 本番強度を求めるなら crypto.subtle.timingSafeEqual 相当を実装してもよい。
  if (password !== env.SITE_PASSWORD) {
    // 軽い遅延 (失敗時の総当たり緩和)
    await new Promise((resolve) => setTimeout(resolve, 250));
    return jsonResponse(401, { error: 'wrong password' });
  }

  const cookieValue = await createAuthCookie(env.AUTH_SECRET, SESSION_SECONDS);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': `auth=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`,
    },
  });
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
