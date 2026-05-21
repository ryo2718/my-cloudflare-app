// 境界出題ルール / 全ハンド出題ルールのハンド抽出ロジック (純粋関数)。
//
// 用語定義は ./GLOSSARY.md を参照。
//   - 境界出題ルール: ファミリー別に「最弱の≈100%参加〜最初の≈0%参加(両端含む連続帯)」を抽出。
//   - 全ハンド出題ルール: 全ハンド。同2ランクのオフ/スーテッドを1枠化(KJo/KJs 等値)。
//
// 実データ検証例 (指示書と一致):
//   Axs UTG = A3s〜A2s / Kxs UTG = K9s〜K4s / ペア HJ = 66〜22 / Axo HJ = ATo〜A8o

import type { Hand } from '../../types/strategy';
import type { HandStrategy } from './preflopBeginner';

/** ランクの強さ順 (A=0 が最強)。 */
const RANK_ORDER = 'AKQJT98765432';

function rankVal(r: string): number {
  return RANK_ORDER.indexOf(r);
}

/** ハンドのファミリーキー。ペア='pair'、それ以外='<高位カード><s|o>' (例: 'As','Ko','9s')。 */
export type HandFamily = string;

export function familyOf(hand: Hand): HandFamily {
  if (hand.length === 2) return 'pair';
  // 例: 'AKs' → 'A' + 's' = 'As'、'98o' → '9' + 'o' = '9o'
  return hand[0] + hand[2];
}

/** ファミリー内ソート用のキッカー値 (小さいほど強い)。ペアはランク値。 */
export function kickerVal(hand: Hand): number {
  if (hand.length === 2) return rankVal(hand[0]);
  return rankVal(hand[1]);
}

/** 参加% = 100 - fold (fold 以外の任意アクション = raise/call/allin/check)。 */
export function participatePct(s: HandStrategy): number {
  return 100 - (s.fold ?? 0);
}

/** ≈100% / ≈0% 判定の許容誤差 (%)。 */
const BOUNDARY_EPS = 0.5;

/**
 * ファミリー fam の境界帯を強い順で返す。
 * 最弱の「≈100% 参加」ハンドから、そこより弱い側で最初の「≈0% 参加」ハンドまで(両端含む)。
 * ≈100% 参加が存在しなければ空配列。≈0% に達しなければファミリー最弱まで。
 */
export function extractFamilyBand(
  hands: Record<string, HandStrategy>,
  fam: HandFamily,
): Hand[] {
  const fh = (Object.keys(hands) as Hand[])
    .filter((h) => familyOf(h) === fam)
    .sort((a, b) => kickerVal(a) - kickerVal(b)); // 強い順
  if (fh.length === 0) return [];

  // 最弱の ≈100% 参加ハンド (上端)
  let upper = -1;
  for (let i = 0; i < fh.length; i++) {
    if (participatePct(hands[fh[i]]) >= 100 - BOUNDARY_EPS) upper = i;
  }
  if (upper < 0) return [];

  // 上端より弱い側で最初の ≈0% 参加ハンド (下端)。無ければファミリー最弱。
  let lower = fh.length - 1;
  for (let i = upper; i < fh.length; i++) {
    if (participatePct(hands[fh[i]]) <= BOUNDARY_EPS) {
      lower = i;
      break;
    }
  }
  return fh.slice(upper, lower + 1);
}

/** ノード全体の境界帯 (全ファミリーを結合)。境界出題ルールの出題候補。 */
export function extractBoundaryBand(hands: Record<string, HandStrategy>): Hand[] {
  const fams = new Set<HandFamily>();
  for (const h of Object.keys(hands) as Hand[]) fams.add(familyOf(h));
  const out: Hand[] = [];
  for (const fam of fams) out.push(...extractFamilyBand(hands, fam));
  return out;
}

// ---------------------------------------------------------------------------
// 全ハンド出題ルール: KJo/KJs 1枠化
// ---------------------------------------------------------------------------

/** 出題スロット。ペアは単一、オフ/スーテッドは [suited, offsuit] の1枠。 */
export type HandSlot = Hand | readonly [Hand, Hand];

/**
 * ハンド一覧をスロットに変換。
 * 同じ2ランクの suited/offsuit (KJs と KJo 等) を 1 枠に統合。ペアは各1枠。
 * 一方しか存在しないランク組は単独ハンドとして1枠。
 */
export function collapseToSlots(handList: ReadonlyArray<Hand>): HandSlot[] {
  const set = new Set(handList);
  const slots: HandSlot[] = [];
  const consumed = new Set<Hand>();
  for (const h of handList) {
    if (consumed.has(h)) continue;
    if (h.length === 2) {
      slots.push(h); // ペア
      consumed.add(h);
      continue;
    }
    const [r1, r2] = [h[0], h[1]];
    const suited = `${r1}${r2}s` as Hand;
    const offsuit = `${r1}${r2}o` as Hand;
    const hasS = set.has(suited);
    const hasO = set.has(offsuit);
    if (hasS && hasO) {
      slots.push([suited, offsuit]);
      consumed.add(suited);
      consumed.add(offsuit);
    } else {
      slots.push(h);
      consumed.add(h);
    }
  }
  return slots;
}

/** スロットから出題する1ハンドを選ぶ (1枠の場合はランダムに片方)。 */
export function pickFromSlot(slot: HandSlot): Hand {
  if (Array.isArray(slot)) {
    return Math.random() < 0.5 ? slot[0] : slot[1];
  }
  return slot as Hand;
}
