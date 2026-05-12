// ハンド入力 (combo "AhKs" or 169 "AKs") を 169 hand 表記に正規化するパーサ。
// 入力ルール:
//  - ランク: 2-9, T, J, Q, K, A (大文字小文字許容)
//  - スート: s, h, d, c (lowercase 想定だが入力時は大小不問)
//  - タイプ: s (suited), o (offsuit) — 169 hand notation の 3文字目
//  - 注意: 's' は「スペード」と「suited」の両方に該当 — 文脈 (位置・長さ) で曖昧解消する
//
// 受理する形式:
//  - "AA" (2文字, 同ランク) → ペア
//  - "98" (2文字, 異ランク) → 入力途中扱いで null
//  - "AKs" / "98o" (3文字 169) → 169 hand
//  - "AAs" / "AAo" (3文字 ペア+型) → 型を無視して "AA"
//  - "AhKs" (4文字 combo) → 169 に変換 ("AKo")
//  - 4文字 同カード ("AhAh") → null
//
// 正規化:
//  - 高ランクが先 ("89s" → "98s", "8K" → "K8")
//  - ペアは型無視

import type { Suit } from '../types/card';

export type HandNotation = string; // "AA", "AKs", "AKo" 等

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
const RANK_SET = new Set<string>(RANK_ORDER);
const SUIT_SET = new Set<string>(['s', 'h', 'd', 'c']);

/** 1文字を rank に正規化 (大小不問)。不正なら null。 */
function normalizeRank(c: string): string | null {
  const u = c.toUpperCase();
  return RANK_SET.has(u) ? u : null;
}

/** 1文字を suit ('s'|'h'|'d'|'c') に正規化 (大小不問)。不正なら null。 */
function normalizeSuit(c: string): Suit | null {
  const l = c.toLowerCase();
  return SUIT_SET.has(l) ? (l as Suit) : null;
}

/** A>K>...>2 の順位 (大きいほど高い) */
function rankIndex(r: string): number {
  return RANK_ORDER.indexOf(r as (typeof RANK_ORDER)[number]);
}

/** 高ランクを左に並べ替えて返す。 */
function orderRanks(a: string, b: string): [string, string] {
  return rankIndex(a) >= rankIndex(b) ? [a, b] : [b, a];
}

/** 入力文字列のクリーニング: 空白・カンマ・ハイフンを除去。 */
function cleanInput(input: string): string {
  return input.replace(/[\s,-]/g, '');
}

/**
 * メインパーサ。入力 → 169 hand notation。
 * 入力途中・不正は null。
 */
export function parseHandInput(input: string): HandNotation | null {
  const cleaned = cleanInput(input);
  if (cleaned.length === 0) return null;
  if (cleaned.length === 2) return parse2Chars(cleaned);
  if (cleaned.length === 3) return parse3Chars(cleaned);
  if (cleaned.length === 4) return parse4Chars(cleaned);
  return null;
}

/** 2文字: 同ランクならペア、異ランクは入力途中扱いで null。 */
function parse2Chars(s: string): HandNotation | null {
  const r1 = normalizeRank(s[0]);
  const r2 = normalizeRank(s[1]);
  if (!r1 || !r2) return null;
  if (r1 === r2) return r1 + r2; // ペア "AA"
  return null; // "98" は s/o 待ちの incomplete
}

/**
 * 3文字: 169 hand notation か、partial combo か。
 *  - chars[0],[1] が両方ランク → 169 hand。chars[2] は s/o (ペアなら無視)。
 *  - chars[0] がランク、chars[1] がスート → partial combo (4文字目待ち) → null
 *  - その他 → null
 */
function parse3Chars(s: string): HandNotation | null {
  const r1 = normalizeRank(s[0]);
  const r2 = normalizeRank(s[1]);
  if (r1 && r2) {
    // 169 hand notation
    if (r1 === r2) return r1 + r2; // ペア "AA" — chars[2] (s/o) は無視
    const t = s[2].toLowerCase();
    if (t !== 's' && t !== 'o') return null;
    const [hi, lo] = orderRanks(r1, r2);
    return `${hi}${lo}${t}`;
  }
  // partial combo の可能性を検査 ([Rank][Suit][Rank])
  if (r1 && normalizeSuit(s[1]) && normalizeRank(s[2])) return null;
  return null; // 全くの invalid
}

/**
 * 4文字 combo: "AhKs" → "AKo"。同カードは拒否。
 */
function parse4Chars(s: string): HandNotation | null {
  const r1 = normalizeRank(s[0]);
  const u1 = normalizeSuit(s[1]);
  const r2 = normalizeRank(s[2]);
  const u2 = normalizeSuit(s[3]);
  if (!r1 || !u1 || !r2 || !u2) return null;
  if (r1 === r2 && u1 === u2) return null; // 同カード
  if (r1 === r2) return r1 + r2; // ペア (例: "AhAs" → "AA")
  const [hi, lo] = orderRanks(r1, r2);
  const type = u1 === u2 ? 's' : 'o';
  return `${hi}${lo}${type}`;
}

/** 入力が「不正」(短すぎる入力途中ではなく、確実にダメ) かどうか。エラー表示判定に使う。 */
export function isInvalidInput(input: string): boolean {
  const cleaned = cleanInput(input);
  // 4文字以上 (combo 完了相当) で parse 失敗 → 不正
  if (cleaned.length >= 4 && parseHandInput(input) === null) return true;
  return false;
}
