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

/** テスト用: モジュールキャッシュをクリア。production では呼ばない。 */
export function clearPreflopCache(): void {
  NODE_CACHE.clear();
  INDEX_CACHE.clear();
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
  const [data, setData] = useState<PreflopV2Node | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!config || !stem) {
      // useFlopNode と統一: prop null 時の state reset。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPreflopNode(config, stem).then(
      (d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [config, stem]);

  return { data, loading, error };
}

export interface UsePreflopIndexResult {
  data: PreflopV2Index | null;
  loading: boolean;
  error: Error | null;
}

export function usePreflopIndex(config: string | null): UsePreflopIndexResult {
  const [data, setData] = useState<PreflopV2Index | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!config) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPreflopIndex(config).then(
      (d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [config]);

  return { data, loading, error };
}
