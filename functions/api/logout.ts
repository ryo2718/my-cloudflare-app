// auth cookie を即時失効させる。
// POST /api/logout   → 200 + Set-Cookie (Max-Age=0)

export const onRequestPost: PagesFunction = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
  });
};
