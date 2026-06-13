import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSavedAccounts,
  saveAccount,
  deleteSavedAccount,
  clearSavedAccounts,
  _internals,
} from './savedAccounts';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
});
afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('saveAccount / getSavedAccounts — 基本', () => {
  it('保存 → 取得で round-trip', () => {
    saveAccount('テスト君', 'test');
    const list = getSavedAccounts();
    expect(list).toHaveLength(1);
    expect(list[0].poker_name).toBe('テスト君');
    expect(list[0].private_pass).toBe('test');
    expect(list[0].last_used_at).toBeGreaterThan(0);
  });

  it('空のアカウント名 / パスワード は no-op', () => {
    saveAccount('', 'pass');
    saveAccount('name', '');
    expect(getSavedAccounts()).toHaveLength(0);
  });

  it('履歴 0 件 → 空配列', () => {
    expect(getSavedAccounts()).toEqual([]);
  });

  it('肩書き meta (is_admin / tester / vip_until) を保存する', () => {
    const until = Date.now() + 30 * 86400000;
    saveAccount('vip', 'p', { is_admin: false, tester: true, vip_until: until });
    const a = getSavedAccounts()[0];
    expect(a.is_admin).toBe(false);
    expect(a.tester).toBe(true);
    expect(a.vip_until).toBe(until);
  });

  it('meta 省略時は vip_until=null、is_admin/tester は undefined', () => {
    saveAccount('plain', 'p');
    const a = getSavedAccounts()[0];
    expect(a.vip_until).toBeNull();
    expect(a.is_admin).toBeUndefined();
    expect(a.tester).toBeUndefined();
  });
});

describe('saveAccount — 上書き挙動', () => {
  it('同名で保存し直すと private_pass 上書き + last_used_at 更新', async () => {
    saveAccount('user1', 'oldpass');
    const before = getSavedAccounts()[0];
    await new Promise((r) => setTimeout(r, 2));
    saveAccount('user1', 'newpass');
    const after = getSavedAccounts()[0];
    expect(after.private_pass).toBe('newpass');
    expect(after.last_used_at).toBeGreaterThan(before.last_used_at);
    expect(getSavedAccounts()).toHaveLength(1);
  });
});

describe('getSavedAccounts — 降順ソート', () => {
  it('last_used_at 降順 (新しいものが先頭)', async () => {
    saveAccount('a', 'pa');
    await new Promise((r) => setTimeout(r, 2));
    saveAccount('b', 'pb');
    await new Promise((r) => setTimeout(r, 2));
    saveAccount('c', 'pc');

    const list = getSavedAccounts();
    expect(list.map((x) => x.poker_name)).toEqual(['c', 'b', 'a']);
  });

  it('既存エントリを再保存すると先頭に上がる', async () => {
    saveAccount('old', 'p1');
    await new Promise((r) => setTimeout(r, 2));
    saveAccount('newer', 'p2');
    expect(getSavedAccounts()[0].poker_name).toBe('newer');

    await new Promise((r) => setTimeout(r, 2));
    saveAccount('old', 'p1-refreshed');
    expect(getSavedAccounts()[0].poker_name).toBe('old');
    expect(getSavedAccounts()[0].private_pass).toBe('p1-refreshed');
  });
});

describe('deleteSavedAccount', () => {
  it('指定 poker_name のみ消える', () => {
    saveAccount('a', 'pa');
    saveAccount('b', 'pb');
    deleteSavedAccount('a');
    const names = getSavedAccounts().map((x) => x.poker_name);
    expect(names).toEqual(['b']);
  });
  it('存在しない名前は no-op', () => {
    saveAccount('a', 'pa');
    expect(() => deleteSavedAccount('nonexistent')).not.toThrow();
    expect(getSavedAccounts()).toHaveLength(1);
  });
});

describe('clearSavedAccounts', () => {
  it('全消去 → 空', () => {
    saveAccount('a', 'pa');
    saveAccount('b', 'pb');
    clearSavedAccounts();
    expect(getSavedAccounts()).toEqual([]);
  });
});

describe('LocalStorage round-trip 永続化', () => {
  it('writeStorage / readStorage 経由で同じ MemoryStorage に書き込まれる', () => {
    saveAccount('persist', 'pp');
    const raw = globalThis.localStorage.getItem(_internals.STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(_internals.STORAGE_VERSION);
    expect(parsed.entries.persist.private_pass).toBe('pp');
  });

  it('壊れた JSON が入っていても read は空 map を返す', () => {
    globalThis.localStorage.setItem(_internals.STORAGE_KEY, 'not json{{{');
    expect(getSavedAccounts()).toEqual([]);
  });

  it('version 不一致は無視 (空扱い)', () => {
    globalThis.localStorage.setItem(
      _internals.STORAGE_KEY,
      JSON.stringify({ version: 99, entries: { 'x': { poker_name: 'x', private_pass: 'p', last_used_at: 1 } } }),
    );
    expect(getSavedAccounts()).toEqual([]);
  });
});

describe('LocalStorage 不可環境 (private browsing 等)', () => {
  it('localStorage undefined → 例外伝播せず空動作', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(() => saveAccount('a', 'pa')).not.toThrow();
    expect(() => deleteSavedAccount('a')).not.toThrow();
    expect(() => clearSavedAccounts()).not.toThrow();
    expect(getSavedAccounts()).toEqual([]);
  });

  it('setItem が throw する Storage でも silent', () => {
    const throwing: Storage = {
      get length() { return 0; },
      clear() {},
      getItem() { return null; },
      key() { return null; },
      removeItem() {},
      setItem() { throw new Error('QuotaExceededError'); },
    };
    (globalThis as unknown as { localStorage: Storage }).localStorage = throwing;
    expect(() => saveAccount('a', 'pa')).not.toThrow();
  });
});
