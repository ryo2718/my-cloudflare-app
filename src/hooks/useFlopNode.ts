// Flop ノード (variant + chain → JSON ファイル) の on-demand fetch hook。
// 既存 `useStrategy` パターンを踏襲: fetch + AbortController + 3 状態。
//
// Variant あたり最大 ~125 ファイル × 各 ~600 KB = ~75 MB なので prefetch 不可。
// ユーザーが breadcrumb / アクションボタンで chain を変えるたびに 1 ファイル fetch。

import { useEffect, useState } from 'react';
import { chainToFilename } from '../data/flopChain';
import type { FlopNode } from '../types/flop';

export interface UseFlopNodeResult {
  data: FlopNode | null;
  loading: boolean;
  error: Error | null;
}

/**
 * 純 fetch ロジック (テスト容易のため分離)。
 *
 * @throws `VITE_FLOP_DATA_BASE_URL` 未設定時 / fetch !ok 時
 */
export async function fetchFlopNode(
  variant: string,
  chain: string[],
  signal?: AbortSignal,
): Promise<FlopNode> {
  const baseUrl = import.meta.env.VITE_FLOP_DATA_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_FLOP_DATA_BASE_URL is not set');
  }
  const filename = chainToFilename(variant, chain);
  const url = `${baseUrl}/${variant}/${filename}`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as FlopNode;
}

/**
 * Variant + chain に対応する FlopNode を on-demand fetch して返す React hook。
 *
 * 依存変更 (variant / chain 内容変更) で再 fetch、AbortController で in-flight cancel。
 * `variant === null` の間は idle 状態 (data=null, loading=false, error=null)。
 *
 * NOTE: `chain` の identity 不変性は不要。内部で `chain.join('|')` を effect dep に
 * 使うため、`chain` を毎 render 新規生成しても無限ループしない。
 */
export function useFlopNode(
  variant: string | null,
  chain: string[],
): UseFlopNodeResult {
  const [data, setData] = useState<FlopNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const chainKey = chain.join('|');

  useEffect(() => {
    if (!variant) {
      // 既存パターン (useStrategy 系と統一): prop null 時の state reset。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetchFlopNode(variant, chain, ctrl.signal)
      .then((node) => {
        setData(node);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });

    return () => ctrl.abort();
    // `chain` 自体は dep に含めず chainKey で代替 (Array reference 不変性に依存しないため)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, chainKey]);

  return { data, loading, error };
}
