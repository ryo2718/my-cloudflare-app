// 役フィルター: ボード + 現在レンジから「成立しうる役」を逆引きする (レンジ構築補助)。
// エクイティ計算には一切関与しない。handEvaluator.ts / rangeEquity.ts は変更せず、
// ここに読み取り専用の役カテゴリ判定 (5〜7枚対応) を持つ。
//
// 役判定 = 案a「現時点の成立役」: 見えているボード(3/4/5枚) + ホール2枚で best hand を判定。
// 二重フィルタ: (1) 現在レンジに含まれるコンボのみ対象 / (2) ボードと衝突するコンボは除外。
//
// カード整数 = rank*4 + suit (rank 0..12 = '2'..'A')。handEvaluator と同一エンコード。

import { comboKeyToInts } from './combos';

const RANK_CHARS = '23456789TJQKA';

export type RoleKey =
  | 'quads'
  | 'fullhouse'
  | 'flush'
  | 'straight'
  | 'trips'
  | 'twopair'
  | 'pair'
  | 'high';

/** 強い順。 */
export const ROLE_ORDER: ReadonlyArray<RoleKey> = [
  'quads',
  'fullhouse',
  'flush',
  'straight',
  'trips',
  'twopair',
  'pair',
  'high',
];

export const ROLE_LABEL: Record<RoleKey, string> = {
  quads: 'フォーカード',
  fullhouse: 'フルハウス',
  flush: 'フラッシュ',
  straight: 'ストレート',
  trips: 'スリーカード',
  twopair: 'ツーペア',
  pair: 'ワンペア',
  high: 'ハイカード',
};

// category index (0..7) → RoleKey。ストレートフラッシュ(本来8)は役一覧に無いため
// フラッシュ(5)にバケットする (madeHand は flush を straight より優先するため自然に該当)。
const ROLE_OF: ReadonlyArray<RoleKey> = [
  'high',
  'pair',
  'twopair',
  'trips',
  'straight',
  'flush',
  'fullhouse',
  'quads',
];

interface BreakdownItemAcc {
  key: string;
  label: string;
  strength: number;
  combos: string[];
  children?: Map<string, { key: string; label: string; strength: number; combos: string[] }>;
}

export interface BreakdownItem {
  key: string;
  label: string;
  combos: string[];
  /** フラッシュのみ: 高さ配下の具体コンボ (3階層目)。 */
  children?: BreakdownItem[];
}

export interface RoleGroup {
  key: RoleKey;
  label: string;
  category: number;
  /** この役で成立する全コンボ key (スート単位)。 */
  combos: string[];
  items: BreakdownItem[];
}

// ---------------------------------------------------------------------------
// 役カテゴリ判定 (5〜7枚, 読み取り専用)
// ---------------------------------------------------------------------------

type MadeHand =
  | { cat: 7; quad: number }
  | { cat: 6; trip: number; pair: number }
  | { cat: 5; flushHigh: number }
  | { cat: 4; top: number }
  | { cat: 3; trip: number }
  | { cat: 2; hi: number; lo: number }
  | { cat: 1; pair: number }
  | { cat: 0; high: number };

/** rank ビットマスクから最高ストレートの最高位 rank。無ければ -1 (A-5 は 3 を返す)。 */
function topStraight(mask: number): number {
  for (let hi = 12; hi >= 4; hi--) {
    let ok = true;
    for (let r = hi; r > hi - 5; r--) {
      if ((mask & (1 << r)) === 0) {
        ok = false;
        break;
      }
    }
    if (ok) return hi;
  }
  if (mask & (1 << 12) && (mask & 0b1111) === 0b1111) return 3;
  return -1;
}

/** 5〜7枚のベストハンド (役カテゴリ + 内訳に必要な rank)。 */
export function madeHand(cards: ReadonlyArray<number>): MadeHand {
  const rc = new Int8Array(13);
  const suitMask = [0, 0, 0, 0];
  const suitCount = [0, 0, 0, 0];
  let rankMask = 0;
  for (const c of cards) {
    const r = c >> 2;
    const s = c & 3;
    rc[r]++;
    suitCount[s]++;
    suitMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  let quad = -1;
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rc[r] === 4) quad = r;
    else if (rc[r] === 3) trips.push(r);
    else if (rc[r] === 2) pairs.push(r);
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;

  if (quad >= 0) return { cat: 7, quad };

  if (trips.length > 0) {
    const trip = trips[0];
    let pair = trips.length > 1 ? trips[1] : -1;
    if (pairs.length > 0 && pairs[0] > pair) pair = pairs[0];
    if (pair >= 0) return { cat: 6, trip, pair };
  }

  if (flushSuit >= 0) {
    let high = -1;
    const m = suitMask[flushSuit];
    for (let r = 12; r >= 0; r--) {
      if (m & (1 << r)) {
        high = r;
        break;
      }
    }
    return { cat: 5, flushHigh: high };
  }

  const st = topStraight(rankMask);
  if (st >= 0) return { cat: 4, top: st };

  if (trips.length > 0) return { cat: 3, trip: trips[0] };
  if (pairs.length >= 2) return { cat: 2, hi: pairs[0], lo: pairs[1] };
  if (pairs.length === 1) return { cat: 1, pair: pairs[0] };

  let high = -1;
  for (let r = 12; r >= 0; r--) {
    if (rankMask & (1 << r)) {
      high = r;
      break;
    }
  }
  return { cat: 0, high };
}

// ---------------------------------------------------------------------------
// 内訳の subKey / ラベル
// ---------------------------------------------------------------------------

const rl = (r: number) => RANK_CHARS[r];

function subFor(m: MadeHand): { key: string; label: string; strength: number } {
  switch (m.cat) {
    case 7:
      return { key: `q${m.quad}`, label: `${rl(m.quad).repeat(4)}`, strength: m.quad };
    case 6:
      return {
        key: `fh${m.trip}_${m.pair}`,
        label: `${rl(m.trip).repeat(3)} ${rl(m.pair).repeat(2)}`,
        strength: m.trip * 13 + m.pair,
      };
    case 4:
      return { key: `st${m.top}`, label: `${rl(m.top)} ハイ`, strength: m.top };
    case 3:
      return { key: `t${m.trip}`, label: `${rl(m.trip).repeat(3)}`, strength: m.trip };
    case 2:
      return {
        key: `tp${m.hi}_${m.lo}`,
        label: `${rl(m.hi).repeat(2)} + ${rl(m.lo).repeat(2)}`,
        strength: m.hi * 13 + m.lo,
      };
    case 1:
      return { key: `p${m.pair}`, label: `${rl(m.pair).repeat(2)}`, strength: m.pair };
    case 0:
      return { key: `h${m.high}`, label: `${rl(m.high)} ハイ`, strength: m.high };
    default:
      return { key: 'x', label: '', strength: 0 };
  }
}

function comboStrength(c0: number, c1: number): number {
  const hi = Math.max(c0 >> 2, c1 >> 2);
  const lo = Math.min(c0 >> 2, c1 >> 2);
  return hi * 13 + lo;
}

// ---------------------------------------------------------------------------
// 逆引き / 適用
// ---------------------------------------------------------------------------

/**
 * ボード + レンジから成立する役を逆引き (強い順、空の役は除外)。
 * exclude: ボード以外で物理的に使えないカード (例: 相手の確定ハンド) を含むコンボも除外。
 */
export function analyzeBoard(
  range: ReadonlyMap<string, number>,
  board: ReadonlyArray<number>,
  exclude?: ReadonlySet<number>,
): RoleGroup[] {
  const boardSet = new Set(board);
  const roles = new Map<RoleKey, { combos: string[]; items: Map<string, BreakdownItemAcc> }>();
  const ensure = (rk: RoleKey) => {
    let r = roles.get(rk);
    if (!r) {
      r = { combos: [], items: new Map() };
      roles.set(rk, r);
    }
    return r;
  };

  for (const [key, w] of range) {
    if (w <= 0) continue;
    const [c0, c1] = comboKeyToInts(key);
    if (boardSet.has(c0) || boardSet.has(c1)) continue; // ボード衝突
    if (exclude && (exclude.has(c0) || exclude.has(c1))) continue; // 相手の確定ハンド等
    const m = madeHand([c0, c1, ...board]);
    const rk = ROLE_OF[m.cat];
    const role = ensure(rk);
    role.combos.push(key);

    if (m.cat === 5) {
      const subKey = `fl${m.flushHigh}`;
      let item = role.items.get(subKey);
      if (!item) {
        item = { key: subKey, label: `${rl(m.flushHigh)} ハイ`, strength: m.flushHigh, combos: [], children: new Map() };
        role.items.set(subKey, item);
      }
      item.combos.push(key);
      item.children!.set(key, { key, label: key, strength: comboStrength(c0, c1), combos: [key] });
    } else {
      const { key: subKey, label, strength } = subFor(m);
      let item = role.items.get(subKey);
      if (!item) {
        item = { key: subKey, label, strength, combos: [] };
        role.items.set(subKey, item);
      }
      item.combos.push(key);
    }
  }

  const out: RoleGroup[] = [];
  for (let cat = 0; cat < ROLE_ORDER.length; cat++) {
    const rk = ROLE_ORDER[cat];
    const r = roles.get(rk);
    if (!r || r.combos.length === 0) continue;
    const items: BreakdownItem[] = [...r.items.values()]
      .sort((a, b) => b.strength - a.strength)
      .map((it) => ({
        key: it.key,
        label: it.label,
        combos: it.combos,
        children: it.children
          ? [...it.children.values()].sort((a, b) => b.strength - a.strength).map((ch) => ({
              key: ch.key,
              label: ch.label,
              combos: ch.combos,
            }))
          : undefined,
      }));
    out.push({
      key: rk,
      label: ROLE_LABEL[rk],
      category: ROLE_ORDER.length - 1 - cat,
      combos: r.combos,
      items,
    });
  }
  return out;
}

/**
 * 役フィルター適用: 現在レンジ ∩ 指定コンボ key 集合。
 * weight は現在レンジの値を引き継ぐ (フィルタは「絞り込み = 置き換え」、足し算ではない)。
 */
export function applyFilter(
  range: ReadonlyMap<string, number>,
  keys: ReadonlySet<string>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const k of keys) {
    const w = range.get(k);
    if (w !== undefined && w > 0) out.set(k, w);
  }
  return out;
}
