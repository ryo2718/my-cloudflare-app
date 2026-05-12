// Helpers over the auto-generated flop variant manifest.
//
// The flop dataset has 45 variants — one per preflop chain that ended in a
// call (e.g. `utgr_bbc` = UTG raise → BB call). This module exposes typed
// helpers for: existence checks, pot-depth classification, opener/caller
// extraction, and preflop-node → flop-variant mapping.
//
// Manifest source (auto-generated): src/data/flopVariantsManifest.ts.

import type { Position } from '../types/strategy';
import { FLOP_VARIANTS } from './flopVariantsManifest';

export { FLOP_VARIANTS, FLOP_CONFIG } from './flopVariantsManifest';

// ----------------------------------------------------------------------------
// Existence check
// ----------------------------------------------------------------------------

/** Variant 名がデータセットに存在するか。 */
export function isAvailableFlopVariant(name: string): boolean {
  return FLOP_VARIANTS.has(name);
}

// ----------------------------------------------------------------------------
// Pot depth classification
// ----------------------------------------------------------------------------

export type PotDepth = 'limp' | 'SRP' | '3bp' | '4bp' | '5bp';

/**
 * Variant 名から pot depth を導出。
 *
 * 判定ロジック: variant 名を `_` で分割し、`<pos>r<digits>?` 形式のセグメント数
 * (= aggression 回数) でカウント。
 *
 * - 0 aggression → 'limp' (SB が limp、BB が option) [`sbc_bb`]
 * - 1 aggression → 'SRP' (通常 SRP & limp+iso 両方含む)
 * - 2 aggression → '3bp'
 * - 3 aggression → '4bp'
 * - 4 aggression → '5bp'
 *
 * NOTE: limp + iso (例 `sbc_bbr3_sbc`) は 1 aggression なので 'SRP' に分類される。
 * 「limp ライン」かどうかは separate に `variant.startsWith('sbc_')` で判定可能。
 */
export function getPotDepth(variant: string): PotDepth {
  const count = countAggressions(variant);
  switch (count) {
    case 0: return 'limp';
    case 1: return 'SRP';
    case 2: return '3bp';
    case 3: return '4bp';
    case 4: return '5bp';
    default:
      throw new Error(`Unexpected aggression count ${count} for variant "${variant}"`);
  }
}

function countAggressions(variant: string): number {
  // セグメント `<pos>r<digits>?` (例: `utgr`, `bbr3`, `sbr14`) を数える。
  // `<pos>c` (例: `bbc`, `sbc`) や bare `<pos>` (例: `bb` in limp variant) は数えない。
  let count = 0;
  for (const seg of variant.split('_')) {
    if (/^[a-z]+r\d*$/.test(seg)) count++;
  }
  return count;
}

// ----------------------------------------------------------------------------
// Opener / caller extraction
// ----------------------------------------------------------------------------

/**
 * Variant から「opener」(最初に voluntary action を取ったポジション) を返す。
 * 通常は preflop の RFI raiser、limp variant では SB。
 */
export function getFlopOpener(variant: string): Position {
  const first = variant.split('_')[0];
  return parsePositionFromToken(first);
}

/**
 * Variant から「caller」(preflop chain の末尾でアクションを閉じたポジション) を返す。
 * `sbc_bb` (limp option) のような末尾 bare position も BB として扱う。
 */
export function getFlopCaller(variant: string): Position {
  const segments = variant.split('_');
  const last = segments[segments.length - 1];
  return parsePositionFromToken(last);
}

/**
 * Variant から「responder」(preflop で 2 番目に voluntary action を取ったポジション) を返す。
 *
 * 例:
 *   `utgr_bbc`           → BB  (BB が UTG の open に call)
 *   `utgr_bbr_utgc`      → BB  (BB が 3-bet、UTG が call で close)
 *   `sbc_bb`             → BB  (SB が limp、BB が option を check)
 *   `cor_btnc`           → BTN (BTN が CO の open に cold-call)
 *
 * 注: `getFlopCaller` は chain の **末尾** を返すのに対し、本関数は **2 番目セグメント**
 * を返す。両者は SRP では一致するが 3bp 以降で異なる (3bp は opener が caller になる)。
 */
export function getFlopResponder(variant: string): Position {
  const segments = variant.split('_');
  if (segments.length < 2) {
    throw new Error(`Cannot extract responder from variant "${variant}"`);
  }
  return parsePositionFromToken(segments[1]);
}

/**
 * Token (例: `utgr`, `bbr27`, `bbc`, `bb`) から Position を抽出。
 * - `<pos>r<digits>?` → 大文字 Position
 * - `<pos>c` → 大文字 Position
 * - `<pos>` (action suffix なし、limp variant の末尾 `bb`) → 大文字 Position
 */
function parsePositionFromToken(token: string): Position {
  const m = token.match(/^([a-z]+?)(?:r\d*|c)?$/);
  if (!m) {
    throw new Error(`Cannot parse position from token "${token}"`);
  }
  return m[1].toUpperCase() as Position;
}

// ----------------------------------------------------------------------------
// Preflop ↔ Flop mapping
// ----------------------------------------------------------------------------

/**
 * Preflop node_path から対応する flop variant を導出。
 *
 * 解決順 (最初に見つかったものを返す):
 *  1. nodePath そのものが variant (e.g. limp 終端 `sbc_bb`)
 *  2. nodePath + 'c' が variant (e.g. `utgr_bb` → `utgr_bbc`)
 *  3. nodePath の末尾セグメントの 1 つ前にサイズが挿入される 4bp/5bp 型
 *     (e.g. `utgr_bbr_utgr_bb` → `utgr_bbr_utgr22_bbc`; 単一サイズの場合のみ)
 *
 * 複数サイズマッチ (e.g. `sbc_bbr_sb` → `sbc_bbr3_sbc` and `sbc_bbr5_sbc`) は null。
 * 該当なしも null。Phase 5/6 で UI 側にサイズ選択を渡す予定。
 */
export function getFlopVariantFromPreflopNode(nodePath: string): string | null {
  // 1. 直接マッチ
  if (FLOP_VARIANTS.has(nodePath)) return nodePath;

  // 2. 末尾に 'c' を足してマッチ
  const withC = `${nodePath}c`;
  if (FLOP_VARIANTS.has(withC)) return withC;

  // 3. サイズ挿入マッチ (単一の場合のみ)
  const segments = nodePath.split('_');
  if (segments.length >= 2) {
    const lastSeg = segments[segments.length - 1];
    const prefix = segments.slice(0, -1).join('_');
    // <prefix>\d+_<lastSeg>c のパターンに合致する variant を全列挙
    const re = new RegExp(`^${escapeRegExp(prefix)}\\d+_${escapeRegExp(lastSeg)}c$`);
    const matches: string[] = [];
    for (const v of FLOP_VARIANTS) {
      if (re.test(v)) matches.push(v);
    }
    if (matches.length === 1) return matches[0];
    // 複数マッチは ambiguous → null (UI 側で選択させる)
  }

  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `getFlopVariantFromPreflopNode` の「ambiguous (multi-size) でも fallback で
 * 1 件返す」版。Phase 6 で preflop → flop 連携 (「Flop に進む」ボタン) 時に使用。
 *
 * 解決順:
 *  1. 厳密版で取れたら返す
 *  2. ambiguous multi-size の場合は match 全件を sort し、最初の (= 最小サイズ) を返す
 *  3. それでも見つからない場合は null
 */
export function getDefaultFlopVariantFromPreflopNode(
  nodePath: string,
): string | null {
  const strict = getFlopVariantFromPreflopNode(nodePath);
  if (strict !== null) return strict;

  // ambiguous の場合: 同じ regex でマッチを全列挙 → sort → 最初を返す
  const segments = nodePath.split('_');
  if (segments.length >= 2) {
    const lastSeg = segments[segments.length - 1];
    const prefix = segments.slice(0, -1).join('_');
    const re = new RegExp(`^${escapeRegExp(prefix)}\\d+_${escapeRegExp(lastSeg)}c$`);
    const matches: string[] = [];
    for (const v of FLOP_VARIANTS) {
      if (re.test(v)) matches.push(v);
    }
    if (matches.length > 0) {
      matches.sort();
      return matches[0];
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Variant 検索 (Selector 用)
// ----------------------------------------------------------------------------

/** SB のみ意味を持つ「open / limp」のアクション選択。それ以外の opener では常に 'open'。 */
export type OpenerAction = 'open' | 'limp';

/**
 * `(opener, responder, depth, openerAction)` 4 軸の組合せから対応する variants を全列挙。
 *
 * 通常は 0 件または 1 件、SB-limp 系の iso サイズ違いなどで複数件返る場合あり
 * (e.g. opener=SB, responder=BB, depth=SRP, action=limp → ['sbc_bbr3_sbc', 'sbc_bbr5_sbc'])。
 * 戻り値はソート済 (alphabetical、サイズが昇順になる傾向)。
 */
export function findFlopVariants(
  opener: Position,
  responder: Position,
  depth: PotDepth,
  openerAction: OpenerAction = 'open',
): string[] {
  const openerLc = opener.toLowerCase();
  const matches: string[] = [];
  for (const v of FLOP_VARIANTS) {
    const segments = v.split('_');
    const seg0 = segments[0];

    // 第 1 セグメント: opener + (r | c)
    if (openerAction === 'limp') {
      if (opener !== 'SB' || seg0 !== 'sbc') continue;
    } else {
      if (seg0 !== `${openerLc}r`) continue;
    }

    // 第 2 セグメント: responder
    if (segments.length < 2) continue;
    try {
      const seg1Pos = parsePositionFromToken(segments[1]);
      if (seg1Pos !== responder) continue;
    } catch {
      continue;
    }

    // pot depth (aggression 数)
    if (getPotDepth(v) !== depth) continue;

    matches.push(v);
  }
  return matches.sort();
}
