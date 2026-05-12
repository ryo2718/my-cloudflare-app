// 入力フロップ → 正準代表ボード名 (= JSON 内 `solutions[i].name`) の Map。
//
// 起動時の自動 prefetch はせず、最初に `getCanonicalBoardName` が呼ばれた時点で
// アンカーファイル (utgr_bbc/flop_root.json) を 1 件だけ fetch して 1,755 個の
// iso signature → 正準ボード名 の Map を構築する (lazy singleton)。
//
// アンカーファイル選定: 全 variant の `solutions[]` は同じ 1,755 ボードを含む
// (同じ board set / 同じ canonical reps) ので、最小 variant 1 つで Map 構築可能。
// `utgr_bbc/flop_root.json` は約 631 KB で十分軽量。

import type { Card } from '../types/card';
import { isoSignature, parseBoardName } from '../utils/flopBoardCanonical';

const ANCHOR_PATH = '/utgr_bbc/flop_root.json';

let mapPromise: Promise<ReadonlyMap<string, string>> | null = null;

interface AnchorFile {
  readonly solutions: ReadonlyArray<{ readonly name: string }>;
}

async function buildMap(): Promise<ReadonlyMap<string, string>> {
  const baseUrl = import.meta.env.VITE_FLOP_DATA_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      'VITE_FLOP_DATA_BASE_URL is not set — flop board map cannot be built',
    );
  }
  const url = `${baseUrl}${ANCHOR_PATH}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch anchor flop file ${url}: ${res.status} ${res.statusText}`,
    );
  }
  const json = (await res.json()) as AnchorFile;
  const map = new Map<string, string>();
  for (const sol of json.solutions) {
    const sig = isoSignature(parseBoardName(sol.name));
    map.set(sig, sol.name);
  }
  return map;
}

/**
 * 任意の 3 枚カードに対応する正準代表ボード名 (例: `"2h2d2c"`) を返す。
 * 初回呼び出し時に Map を構築 (~1 file fetch, ~600 KB)、以降はメモリから即返す。
 * 該当 iso class がデータに無い場合は null。
 */
export async function getCanonicalBoardName(
  cards: [Card, Card, Card],
): Promise<string | null> {
  if (!mapPromise) {
    mapPromise = buildMap().catch((err) => {
      // fetch 失敗時は singleton を reset し、次回呼び出しで再試行可能にする
      mapPromise = null;
      throw err;
    });
  }
  const map = await mapPromise;
  const sig = isoSignature(cards);
  return map.get(sig) ?? null;
}

/**
 * テスト専用: 内部 singleton state をリセット。製品コードから呼ばないこと。
 */
export function _resetCanonicalMap(): void {
  mapPromise = null;
}
