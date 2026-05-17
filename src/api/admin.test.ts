import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  apiAdminListAccounts,
  apiAdminListGroupKeys,
  apiAdminRotateGroupKey,
} from './admin';

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiAdminListAccounts', () => {
  it('GET /api/admin/accounts with Bearer header', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accounts: [
          {
            id: 1,
            poker_name: 'テスト君',
            private_pass: 'test',
            is_admin: true,
            created_at: 1,
            last_login_at: 2,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', spy);
    const list = await apiAdminListAccounts('sid');
    expect(spy).toHaveBeenCalledWith('/api/admin/accounts', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer sid' }),
    }));
    expect(list[0].poker_name).toBe('テスト君');
  });

  it('403 → AuthApiError(code=forbidden)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden' }),
    }));
    await expect(apiAdminListAccounts('sid')).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
    });
  });
});

describe('apiAdminListGroupKeys', () => {
  it('GET /api/admin/group_keys', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        group_keys: [{ id: 1, key_value: '2818', active_from: 1, active_until: null, created_at: 1 }],
      }),
    });
    vi.stubGlobal('fetch', spy);
    const list = await apiAdminListGroupKeys('sid');
    expect(list[0].key_value).toBe('2818');
    expect(list[0].active_until).toBeNull();
  });
});

describe('apiAdminRotateGroupKey', () => {
  it('POST /api/admin/group_key with new_key body', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ active_from: 1234, key_value: '4915' }),
    });
    vi.stubGlobal('fetch', spy);
    const res = await apiAdminRotateGroupKey('sid', '4915');
    expect(spy).toHaveBeenCalledWith('/api/admin/group_key', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer sid',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ new_key: '4915' }),
    }));
    expect(res.key_value).toBe('4915');
  });

  it('400 invalid_payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_payload' }),
    }));
    await expect(apiAdminRotateGroupKey('sid', '')).rejects.toMatchObject({
      code: 'invalid_payload',
      status: 400,
    });
  });
});
