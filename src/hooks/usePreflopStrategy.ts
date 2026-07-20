// Phase 2a: 新 preflop range (R2 配信) のノード / index を on-demand fetch するフック。
// useFlopNode.ts のパターンを踏襲: fetch + AbortController + 3 状態 + module-level
// memoization (同一 URL は in-flight Promise を共有、成功後は再 fetch しない)。
//
// データソース: VITE_PREFLOP_DATA_BASE_URL (= .../data/preflop/v1)
//   ノード : ${base}/${config}/by_chain/${stem}.json
//   index : ${base}/${config}/index.json

import { useEffect, useState } from 'react';
import type { PreflopV2Index, PreflopV2Node } from '../data/preflopV2/types';

function baseUrl(): string {
  const base = import.meta.env.VITE_PREFLOP_DATA_BASE_URL;
  if (!base) throw new Error('VITE_PREFLOP_DATA_BASE_URL is not set');
  return base;
}

const NODE_CACHE = new Map<string, Promise<PreflopV2Node>>();
const INDEX_CACHE = new Map<string, Promise<PreflopV2Index>>();

// 解決済みの値。render 中に同期的に読めるので、取得済みノードへの遷移で
// loading 状態を一切挟まない (= 画面が「読み込み中」に潰れて再展開しない)。
const NODE_RESOLVED = new Map<string, PreflopV2Node>();
const INDEX_RESOLVED = new Map<string, PreflopV2Index>();

/** テスト用: モジュールキャッシュをクリア。production では呼ばない。 */
export function clearPreflopCache(): void {
  NODE_CACHE.clear();
  INDEX_CACHE.clear();
  NODE_RESOLVED.clear();
  INDEX_RESOLVED.clear();
}

async function fetchJson<T>(url: string, cache: Map<string, Promise<T>>): Promise<T> {
  let shared = cache.get(url);
  if (!shared) {
    shared = (async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as T;
    })();
    cache.set(url, shared);
    shared.catch(() => cache.delete(url));
  }
  return shared;
}

export async function fetchPreflopNode(config: string, stem: string): Promise<PreflopV2Node> {
  return fetchJson<PreflopV2Node>(`${baseUrl()}/${config}/by_chain/${stem}.json`, NODE_CACHE);
}

export async function fetchPreflopIndex(config: string): Promise<PreflopV2Index> {
  return fetchJson<PreflopV2Index>(`${baseUrl()}/${config}/index.json`, INDEX_CACHE);
}

export interface UsePreflopNodeResult {
  data: PreflopV2Node | null;
  loading: boolean;
  error: Error | null;
}

export function usePreflopNode(config: string | null, stem: string | null): UsePreflopNodeResult {
  const key = config && stem ? `${config}/${stem}` : null;
  // 取得済みなら render 中に同期で確定 → loading を挟まないので画面が潰れない。
  const cached = key ? NODE_RESOLVED.get(key) ?? null : null;
  // 未取得ノードへの初回遷移でも画面を空にしない: 直前のノードを表示したまま差し替える
  // (stale-while-revalidate)。これが無いと毎タップでページが 1 行に潰れて視線が飛ぶ。
  const [previous, setPrevious] = useState<PreflopV2Node | null>(null);
  const [, bump] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) setPrevious(cached);
  }, [cached]);

  useEffect(() => {
    if (!config || !stem || !key || NODE_RESOLVED.has(key)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPending(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setPending(key);
    setError(null);
    fetchPreflopNode(config, stem).then(
      (d) => {
        NODE_RESOLVED.set(key, d);
        if (cancelled) return;
        setPending(null);
        bump((n) => n + 1);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setPending(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [config, stem, key]);

  // 取得に失敗した場合は前ノードを出し続けない (「タップしても何も起きない」に見えるため)。
  return { data: cached ?? (error ? null : previous), loading: pending !== null, error };
}

export interface UsePreflopIndexResult {
  data: PreflopV2Index | null;
  loading: boolean;
  error: Error | null;
}

export function usePreflopIndex(config: string | null): UsePreflopIndexResult {
  const cached = config ? INDEX_RESOLVED.get(config) ?? null : null;
  const [, bump] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!config || INDEX_RESOLVED.has(config)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPending(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setPending(config);
    setError(null);
    fetchPreflopIndex(config).then(
      (d) => {
        INDEX_RESOLVED.set(config, d);
        if (cancelled) return;
        setPending(null);
        bump((n) => n + 1);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setPending(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [config]);

  return { data: cached, loading: pending !== null, error };
}
