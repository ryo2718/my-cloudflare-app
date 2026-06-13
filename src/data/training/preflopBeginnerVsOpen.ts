// プリフロップ初級「vs オープン」モードの出題生成。
//   各 (アグレッサー, ヒーロー) の vs_open ノード ({opener}r_{hero}.json) を読み、
//   「相手のオープンに対して allin/raise/call/fold のどれを取るか」を複数選択で答える問題を 20 問生成。
//
// 出題規則 (フェーズ2の preflopBeginnerExt を使用):
//   - EV 閾値: topPct <= 40 のハンドのみ候補 (isEligibleByEvThreshold)
//   - 全戦略混合の除外: major(80%+) を持たない分散ハンドは出さない (isAllMixedStrategy)
//   - AA・KK の除外: 簡単すぎるため出さない (強すぎるハンド除外は本モードでは不適用)
//   - ポジション配分: アグレッサー(opener)均等 4 問ずつ × 5 = 20 問。
//     各アグレッサー内でヒーローを可能な限り分散 (UTG=5ヒーローから4、HJ=4ヒーロー1問ずつ、
//     CO=3ヒーロー2/1/1、BTN=2ヒーロー2/2、SB=BBのみ4問)。
// 採点は preflopBeginnerExt.scoreGentleSelect (0/1, 減点なし) を呼び出し側 (プレイ画面) で行う。

import { handToCards, type HandStrategy, type PreflopQuestion, VS_OPEN_PAIRS } from './preflopBeginner';
import { isEligibleByEvThreshold, isAllMixedStrategy } from './preflopBeginnerExt';
import type { Hand, Position } from '../../types/strategy';

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

/** 出題するアグレッサー (open = RFI) のポジション順。 */
export const VS_OPEN_OPENERS: ReadonlyArray<Position> = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
/** 1 アグレッサーあたりの出題数 (均等配分 = 20 問)。 */
export const PER_OPENER = 4;
/** 簡単すぎるため出題しないハンド。 */
export const VS_OPEN_EXCLUDED_HANDS: ReadonlyArray<Hand> = ['AA', 'KK'] as Hand[];

export interface BeginnerVsOpenQuestion {
  /** アグレッサー (オープンした側)。 */
  opener: Position;
  /** ヒーロー (応答する側)。 */
  hero: Position;
  hand: Hand;
  cards: PreflopQuestion['cards'];
  /** 該当ハンドの GTO 戦略 (採点・レンジ表示用)。 */
  strategy: HandStrategy;
  /** アニメ・レンジ表示用ノードファイル名 ({opener}r_{hero}.json)。 */
  nodeFile: string;
}

/** vsOpen[opener][hero] = hand→strategy。 */
export type VsOpenNodes = Partial<Record<Position, Partial<Record<Position, Record<string, HandStrategy>>>>>;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** ノードファイル名 (例: utgr_bb.json)。 */
export function vsOpenNodeFile(opener: Position, hero: Position): string {
  return `${opener.toLowerCase()}r_${hero.toLowerCase()}.json`;
}

/** あるペアの出題候補ハンド (EV<=40 / AA・KK除外 / 全戦略混合除外)。 */
export function candidatesFor(hands: Record<string, HandStrategy>): Hand[] {
  const out: Hand[] = [];
  for (const h of Object.keys(hands) as Hand[]) {
    if (!isEligibleByEvThreshold(h)) continue;
    if (VS_OPEN_EXCLUDED_HANDS.includes(h)) continue; // AA・KK は出さない
    if (isAllMixedStrategy(hands[h])) continue; // 全戦略混合は出さない
    out.push(h);
  }
  return out;
}

/** opener ごとのヒーロー一覧 (VS_OPEN_PAIRS をボード順でグループ化)。 */
function heroesByOpener(): Map<Position, Position[]> {
  const m = new Map<Position, Position[]>();
  for (const [opener, hero] of VS_OPEN_PAIRS) {
    (m.get(opener) ?? m.set(opener, []).get(opener)!).push(hero);
  }
  return m;
}

/** ロード済みノードから 20 問を生成 (純粋関数)。 */
export function buildBeginnerVsOpenQuestions(nodes: VsOpenNodes): BeginnerVsOpenQuestion[] {
  const out: BeginnerVsOpenQuestion[] = [];
  const heroes = heroesByOpener();
  // 同一ノードでハンド重複を避けるための消費済みセット。
  const used = new Map<string, Set<Hand>>();

  for (const opener of VS_OPEN_OPENERS) {
    const heroList = heroes.get(opener);
    if (!heroList || heroList.length === 0) continue;
    // ヒーローをシャッフルし、4 スロットに循環割り当て (分散優先)。
    const shuffled = shuffle([...heroList]);
    for (let i = 0; i < PER_OPENER; i++) {
      const hero = shuffled[i % shuffled.length];
      const hands = nodes[opener]?.[hero];
      if (!hands) continue;
      const key = `${opener}|${hero}`;
      const consumed = used.get(key) ?? used.set(key, new Set()).get(key)!;
      const pool = shuffle(candidatesFor(hands).filter((h) => !consumed.has(h)));
      const hand = pool[0];
      if (!hand) continue; // 候補枯渇 (実データでは起きない想定)
      consumed.add(hand);
      out.push({
        opener,
        hero,
        hand,
        cards: handToCards(hand),
        strategy: hands[hand],
        nodeFile: vsOpenNodeFile(opener, hero),
      });
    }
  }
  return shuffle(out);
}

/** 全 15 ペアのノードを fetch して 20 問を生成。 */
export async function generateBeginnerVsOpenQuestions(): Promise<BeginnerVsOpenQuestion[]> {
  const nodes: VsOpenNodes = {};
  await Promise.all(
    VS_OPEN_PAIRS.map(async ([opener, hero]) => {
      try {
        const res = await fetch(`${PREFLOP_DATA_ROOT}/${vsOpenNodeFile(opener, hero)}`);
        if (!res.ok) return;
        const raw = (await res.json()) as { hands?: Record<string, HandStrategy> };
        if (!raw.hands) return;
        if (!nodes[opener]) nodes[opener] = {};
        nodes[opener]![hero] = raw.hands;
      } catch {
        /* 1 ファイル失敗は skip */
      }
    }),
  );
  return buildBeginnerVsOpenQuestions(nodes);
}
