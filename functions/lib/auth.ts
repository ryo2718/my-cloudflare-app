// Cookie 署名/検証ユーティリティ。
// HMAC-SHA256 を Web Crypto API (Cloudflare Workers ランタイム) で実行。
//
// Cookie 形式: `<base64url(payload)>.<base64url(signature)>`
//   payload は JSON `{ exp: number }` (UNIX秒)。
// 検証: 署名一致 + exp が現在時刻より未来。

interface AuthPayload {
  exp: number; // UNIX秒
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncodeString(s: string): string {
  return b64urlEncode(new TextEncoder().encode(s));
}

function b64urlDecodeString(b64url: string): string {
  // Restore standard base64 padding
  const std = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
  return atob(padded);
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

/** 一定時間で固定 (タイミング攻撃対策) */
function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** 認証 cookie の値を生成。expSeconds 秒だけ有効。 */
export async function createAuthCookie(secret: string, expSeconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expSeconds;
  const payload: AuthPayload = { exp };
  const payloadB64 = b64urlEncodeString(JSON.stringify(payload));
  const sig = await hmacSign(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

/** Cookie 値を検証。署名一致 + 未失効なら true。 */
export async function verifyAuthCookie(cookieValue: string, secret: string): Promise<boolean> {
  if (!cookieValue) return false;
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;

  const expectedSig = await hmacSign(secret, payloadB64);
  if (!constantTimeEq(signature, expectedSig)) return false;

  try {
    const payload = JSON.parse(b64urlDecodeString(payloadB64)) as AuthPayload;
    if (typeof payload.exp !== 'number') return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/** Cookie ヘッダから auth=... を抽出 */
export function getAuthCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)auth=([^;]+)/);
  return m ? m[1] : null;
}

export const SESSION_SECONDS = 30 * 24 * 60 * 60; // 30日
