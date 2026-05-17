import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiSignup,
  AuthApiError,
} from './auth';

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchSuccess(body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function mockFetchError(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('apiLogin', () => {
  it('POST /api/auth/login with payload', async () => {
    const fetchSpy = mockFetchSuccess({
      session_id: 'sid-1',
      account: { id: 1, poker_name: 'テスト君', is_admin: true },
    });
    const result = await apiLogin({
      pokerName: 'テスト君',
      privatePass: 'test',
      groupKey: '2818',
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poker_name: 'テスト君',
        private_pass: 'test',
        group_key: '2818',
      }),
    });
    expect(result.session_id).toBe('sid-1');
    expect(result.account.is_admin).toBe(true);
  });

  it('401 で AuthApiError (code=invalid_credentials)', async () => {
    mockFetchError(401, { error: 'invalid_credentials' });
    await expect(
      apiLogin({ pokerName: 'x', privatePass: 'y', groupKey: '2818' }),
    ).rejects.toMatchObject({
      code: 'invalid_credentials',
      status: 401,
    });
  });

  it('JSON parse 失敗時も AuthApiError (code=http_<status>)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('parse error');
        },
      }),
    );
    await expect(
      apiLogin({ pokerName: 'x', privatePass: 'y', groupKey: 'z' }),
    ).rejects.toMatchObject({
      code: 'http_500',
      status: 500,
    });
  });
});

describe('apiSignup', () => {
  it('POST /api/auth/signup with payload', async () => {
    const fetchSpy = mockFetchSuccess({
      session_id: 'sid-2',
      account: { id: 2, poker_name: 'newuser', is_admin: false },
    });
    const result = await apiSignup({
      pokerName: 'newuser',
      privatePass: 'pw',
      groupKey: '2818',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/signup',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.account.is_admin).toBe(false);
  });

  it('400 name_taken', async () => {
    mockFetchError(400, { error: 'name_taken' });
    await expect(
      apiSignup({ pokerName: 'dup', privatePass: 'pw', groupKey: '2818' }),
    ).rejects.toMatchObject({ code: 'name_taken', status: 400 });
  });
});

describe('apiMe', () => {
  it('Authorization: Bearer ヘッダで GET', async () => {
    const fetchSpy = mockFetchSuccess({
      account: { id: 1, poker_name: 'テスト君', is_admin: true },
    });
    const result = await apiMe('sid-1');
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: 'Bearer sid-1' },
    });
    expect(result.account.id).toBe(1);
  });

  it('401 → AuthApiError(code=unauthorized)', async () => {
    mockFetchError(401, { error: 'unauthorized' });
    await expect(apiMe('badsid')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });
});

describe('apiLogout', () => {
  it('Bearer ヘッダ付き POST、エラーでも resolve (best effort)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal' }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    await expect(apiLogout('sid-1')).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer sid-1' },
    });
  });
});

describe('AuthApiError', () => {
  it('code + status を保持', () => {
    const err = new AuthApiError('invalid_group_key', 401);
    expect(err.code).toBe('invalid_group_key');
    expect(err.status).toBe(401);
    expect(err.message).toContain('401');
  });
});
