import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  boardCanonicalKey,
  canonicalizeBoardName,
  recordBoardSelection,
  getTopBoards,
  clearBoardHistory,
  _internals,
} from './boardHistory';
import { parseBoardName } from '../utils/flopBoardCanonical';

// ----------------------------------------------------------------------------
// LocalStorage mock
// ----------------------------------------------------------------------------

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(i: number) { return Array.from(this.data.keys())[i] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

beforeEach(() => {
  // 各テストで完全に独立した storage を用意。
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

// ----------------------------------------------------------------------------
// boardCanonicalKey / canonicalizeBoardName
// ----------------------------------------------------------------------------

describe('boardCanonicalKey — 境界値・同テクスチャ集約', () => {
  it('rainbow 高ハイカード: AsKhQd → AsKhQd (class A=s, B=h, C=d)', () => {
    expect(boardCanonicalKey(parseBoardName('AsKhQd'))).toBe('AsKhQd');
  });

  it('同テクスチャ rainbow: AsKhQd と AhKdQc は同じ canonical', () => {
    const a = boardCanonicalKey(parseBoardName('AsKhQd'));
    const b = boardCanonicalKey(parseBoardName('AhKdQc'));
    expect(a).toBe(b);
    expect(a).toBe('AsKhQd');
  });

  it('モノトーン: AsKsQs と AhKhQh は同じ canonical (3 枚同 suit)', () => {
    const a = boardCanonicalKey(parseBoardName('AsKsQs'));
    const b = boardCanonicalKey(parseBoardName('AhKhQh'));
    expect(a).toBe(b);
    expect(a).toBe('AsKsQs');
  });

  it('ツーフラッシュ: AsKs3h と AdKd3c は同じ canonical', () => {
    const a = boardCanonicalKey(parseBoardName('AsKs3h'));
    const b = boardCanonicalKey(parseBoardName('AdKd3c'));
    expect(a).toBe(b);
    expect(a).toBe('AsKs3h');
  });

  it('ペアボード rainbow: 2h2d2c → 2s2h2d (rank-desc, class A→s/B→h/C→d)', () => {
    expect(boardCanonicalKey(parseBoardName('2h2d2c'))).toBe('2s2h2d');
    expect(boardCanonicalKey(parseBoardName('2s2d2h'))).toBe('2s2h2d');
  });

  it('ペアボード ツートーン: 3h3d2s と 3c3s2h は同じ canonical', () => {
    const a = boardCanonicalKey(parseBoardName('3h3d2s'));
    const b = boardCanonicalKey(parseBoardName('3c3s2h'));
    expect(a).toBe(b);
  });

  it('Th9c8d (rainbow connectors) → Ts9h8d', () => {
    expect(canonicalizeBoardName('Th9c8d')).toBe('Ts9h8d');
  });

  it('異なるテクスチャは異なる canonical', () => {
    const monotone = canonicalizeBoardName('AsKsQs');
    const rainbow = canonicalizeBoardName('AsKhQd');
    const twotone = canonicalizeBoardName('AsKs3h');
    expect(monotone).not.toBe(rainbow);
    expect(rainbow).not.toBe(twotone);
    expect(twotone).not.toBe(monotone);
  });

  it('canonicalizeBoardName: 不正な入力で throw', () => {
    expect(() => canonicalizeBoardName('xxx')).toThrow();
    expect(() => canonicalizeBoardName('AsAs3h')).toThrow(/Duplicate/);
  });
});

// ----------------------------------------------------------------------------
// recordBoardSelection / count / lastUsedAt
// ----------------------------------------------------------------------------

describe('recordBoardSelection — count 増加', () => {
  it('初回記録 → count=1', () => {
    recordBoardSelection('AsKhQd');
    const entries = _internals.readStorage();
    const e = entries[canonicalizeBoardName('AsKhQd')];
    expect(e?.count).toBe(1);
    expect(e?.lastUsedAt).toBeGreaterThan(0);
  });

  it('同じボードを 3 回記録 → count=3', () => {
    recordBoardSelection('AsKhQd');
    recordBoardSelection('AsKhQd');
    recordBoardSelection('AsKhQd');
    const entries = _internals.readStorage();
    expect(entries[canonicalizeBoardName('AsKhQd')]?.count).toBe(3);
  });

  it('同テクスチャ別 suit 入力 → 同じ canonical エントリに集約', () => {
    recordBoardSelection('AsKs3h'); // ts: c=A, c=A, c=B
    recordBoardSelection('AdKd3c'); // ts: c=A, c=A, c=B — 同 sig
    recordBoardSelection('AhKh3s'); // ts: c=A, c=A, c=B — 同 sig
    const entries = _internals.readStorage();
    const canonical = canonicalizeBoardName('AsKs3h');
    expect(Object.keys(entries)).toEqual([canonical]);
    expect(entries[canonical]?.count).toBe(3);
  });

  it('lastUsedAt は記録ごとに更新', async () => {
    recordBoardSelection('AsKhQd');
    const t1 = _internals.readStorage()[canonicalizeBoardName('AsKhQd')]?.lastUsedAt ?? 0;
    await new Promise((r) => setTimeout(r, 2));
    recordBoardSelection('AsKhQd');
    const t2 = _internals.readStorage()[canonicalizeBoardName('AsKhQd')]?.lastUsedAt ?? 0;
    expect(t2).toBeGreaterThan(t1);
  });

  it('不正なボード名は silent (例外伝播しない)', () => {
    expect(() => recordBoardSelection('xxx')).not.toThrow();
    expect(Object.keys(_internals.readStorage())).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------------
// getTopBoards — order + default 埋め草
// ----------------------------------------------------------------------------

describe('getTopBoards — 順序とデフォルト埋め', () => {
  it('履歴 0 件 → 全部デフォルト (n=8 で 8 件)', () => {
    const top = getTopBoards(8);
    expect(top).toHaveLength(8);
    // 各 default が canonical 化されて入っている
    for (const def of _internals.DEFAULT_VECTOR_BOARDS) {
      expect(top).toContain(canonicalizeBoardName(def));
    }
  });

  it('n=3 → 上位 3 件のみ', () => {
    const top = getTopBoards(3);
    expect(top).toHaveLength(3);
  });

  it('n=0 → 空配列', () => {
    expect(getTopBoards(0)).toEqual([]);
  });

  it('count 降順で並ぶ', () => {
    recordBoardSelection('AsKhQd'); // ×3
    recordBoardSelection('AsKhQd');
    recordBoardSelection('AsKhQd');
    recordBoardSelection('AsKsQs'); // ×1
    recordBoardSelection('Th9c8d'); // ×2
    recordBoardSelection('Th9c8d');

    const top = getTopBoards(3);
    expect(top[0]).toBe(canonicalizeBoardName('AsKhQd'));
    expect(top[1]).toBe(canonicalizeBoardName('Th9c8d'));
    expect(top[2]).toBe(canonicalizeBoardName('AsKsQs'));
  });

  it('同 count では lastUsedAt 降順 (新しい方が上)', async () => {
    recordBoardSelection('AsKhQd');
    await new Promise((r) => setTimeout(r, 2));
    recordBoardSelection('AsKsQs');
    const top = getTopBoards(2);
    // 両方 count=1、AsKsQs の方が新しい → 先頭
    expect(top[0]).toBe(canonicalizeBoardName('AsKsQs'));
    expect(top[1]).toBe(canonicalizeBoardName('AsKhQd'));
  });

  it('履歴 3 件 + デフォルト 5 件で 8 件埋まる', () => {
    recordBoardSelection('AsKhQd');
    recordBoardSelection('AsKsQs');
    recordBoardSelection('Th9c8d'); // これは default にもあるテクスチャ
    const top = getTopBoards(8);
    expect(top).toHaveLength(8);
    // 履歴の 3 件が先頭にいるはず (デフォルトの並びより前)
    expect(top.slice(0, 3)).toEqual(
      expect.arrayContaining([
        canonicalizeBoardName('AsKhQd'),
        canonicalizeBoardName('AsKsQs'),
        canonicalizeBoardName('Th9c8d'),
      ]),
    );
    // 重複なし
    expect(new Set(top).size).toBe(top.length);
  });

  it('履歴とデフォルトが同テクスチャ → 重複しない', () => {
    // "Th9c8d" は default にも入っている
    recordBoardSelection('Th9c8d');
    const top = getTopBoards(8);
    // canonical 化済の "Th9c8d" は 1 度だけ出現
    const target = canonicalizeBoardName('Th9c8d');
    expect(top.filter((b) => b === target)).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------
// clearBoardHistory
// ----------------------------------------------------------------------------

describe('clearBoardHistory', () => {
  it('全エントリを消去 → getTopBoards はデフォルトのみ', () => {
    recordBoardSelection('AsKhQd');
    recordBoardSelection('AsKsQs');
    clearBoardHistory();
    const top = getTopBoards(8);
    // canonicalize した default の集合と一致
    const expected = new Set(
      _internals.DEFAULT_VECTOR_BOARDS.map((b) => canonicalizeBoardName(b)),
    );
    expect(new Set(top)).toEqual(expected);
  });
});

// ----------------------------------------------------------------------------
// LocalStorage round-trip + 失敗耐性
// ----------------------------------------------------------------------------

describe('LocalStorage round-trip', () => {
  it('記録 → 別 read で永続化されている', () => {
    recordBoardSelection('AsKhQd');
    recordBoardSelection('AsKhQd');
    // 直接 storage から読む
    const raw = globalThis.localStorage.getItem('flopBoardHistory');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.entries[canonicalizeBoardName('AsKhQd')]?.count).toBe(2);
  });

  it('壊れた JSON が入っていても read 失敗で空 map になる', () => {
    globalThis.localStorage.setItem('flopBoardHistory', '{not valid json');
    expect(getTopBoards(8)).toHaveLength(8); // デフォルトだけ返る
  });

  it('別 version の data は無視される', () => {
    globalThis.localStorage.setItem(
      'flopBoardHistory',
      JSON.stringify({ version: 99, entries: { 'AsKhQd': { canonical: 'AsKhQd', count: 5, lastUsedAt: 0 } } }),
    );
    // version mismatch → 履歴空扱い
    const top = getTopBoards(8);
    expect(top).not.toContain('AsKhQd'); // 履歴側に来ないので default 順
  });
});

describe('localStorage 不可環境での失敗耐性', () => {
  it('localStorage 未定義 → 例外伝播せず getTopBoards はデフォルト返す', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(() => recordBoardSelection('AsKhQd')).not.toThrow();
    expect(() => clearBoardHistory()).not.toThrow();
    const top = getTopBoards(8);
    expect(top).toHaveLength(8);
  });

  it('setItem が throw する localStorage (QuotaExceeded 等) でも silent', () => {
    const throwingStorage: Storage = {
      get length() { return 0; },
      clear() {},
      getItem() { return null; },
      key() { return null; },
      removeItem() {},
      setItem() { throw new Error('QuotaExceededError'); },
    };
    (globalThis as unknown as { localStorage: Storage }).localStorage = throwingStorage;
    expect(() => recordBoardSelection('AsKhQd')).not.toThrow();
  });
});
