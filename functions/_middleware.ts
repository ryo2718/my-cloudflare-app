// 全リクエストに対する認証ゲート。
// - PUBLIC_PATHS は素通り (ログインページ・login/logout API・favicon)
// - その他: auth cookie 検証 → 通れば next、ダメなら HTML は /login.html に 302、
//   非HTML (JSON/CSS/JS/データ等) は 401 を返す
//
// 環境変数:
//   AUTH_SECRET   - HMAC 署名鍵 (必須、Cloudflare Pages の Secret 環境変数で設定)

import { getAuthCookie, verifyAuthCookie } from './lib/auth';

interface Env {
  SITE_PASSWORD: string; // /api/login で使用
  AUTH_SECRET: string;   // 署名鍵
}

// Cloudflare Pages は `.html` 拡張子を内部的に剥がす ("extensionless URL" 機能):
//   /login.html を要求しても middleware からは url.pathname === '/login' に見える。
// そのため拡張子付き / 拡張子無し 両方を許可しないとリダイレクトループする。
const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/login.html',
  '/api/login',
  '/api/logout',
  '/favicon.svg',
  '/favicon.ico',
]);

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 公開パスは素通り
  if (PUBLIC_PATHS.has(url.pathname)) {
    return next();
  }

  // 認証 cookie をチェック
  const cookie = getAuthCookie(request.headers.get('Cookie'));
  if (cookie && env.AUTH_SECRET && (await verifyAuthCookie(cookie, env.AUTH_SECRET))) {
    return next();
  }

  // 未認証
  // - HTML を期待するナビゲーションは /login.html に 302
  // - それ以外 (XHR/fetch/JSON) は 401 で素直に拒否
  const accept = request.headers.get('Accept') ?? '';
  const wantsHtml =
    accept.includes('text/html') || request.headers.get('Sec-Fetch-Dest') === 'document';

  if (wantsHtml) {
    const loginUrl = new URL('/login.html', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
};
