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
import { isEligibleByEvThreshold, isAllMixedStrategy, isValueRaise, isBluffOrSemiBluffRaise } from './preflopBeginnerExt';
import { EV_RANKING } from '../evRanking';
import type { Hand, Position } from '../../types/strategy';

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

/** 出題するアグレッサー (open = RFI) のポジション順。 */
export const VS_OPEN_OPENERS: ReadonlyArray<Position> = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
/** 簡単すぎるため出題しないハンド。 */
export const VS_OPEN_EXCLUDED_HANDS: ReadonlyArray<Hand> = ['AA', 'KK'] as Hand[];

/** 全出題数。 */
export const TOTAL_QUESTIONS = 20;
/** バリューレイズ系の保証出題数。 */
export const VALUE_QUOTA = 4;
/** ブラフ/セミブラフレイズ系の保証出題数。 */
export const BLUFF_QUOTA = 4;

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

/** 1 候補エントリ (opener×hero×hand)。 */
interface Entry {
  opener: Position;
  hero: Position;
  hand: Hand;
  strategy: HandStrategy;
}

function topPctOf(hand: Hand): number {
  return EV_RANKING[hand]?.topPct ?? 999;
}

/** 全 15 ペアの出題候補を平坦化。 */
function allEntries(nodes: VsOpenNodes): Entry[] {
  const out: Entry[] = [];
  for (const [opener, hero] of VS_OPEN_PAIRS) {
    const hands = nodes[opener]?.[hero];
    if (!hands) continue;
    for (const hand of candidatesFor(hands)) {
      out.push({ opener, hero, hand, strategy: hands[hand] });
    }
  }
  return out;
}

const keyOfEntry = (e: Entry): string => `${vsOpenNodeFile(e.opener, e.hero)}:${e.hand}`;

/**
 * バケットから n 個を「アグレッサーを round-robin で巡回」して選ぶ (ポジション分散)。
 * used に入っているもの・選んだものは除外。プールが尽きたら取れた分だけ返す。
 */
function pickSpread(bucket: Entry[], n: number, used: Set<string>): Entry[] {
  const byOpener = new Map<Position, Entry[]>();
  for (const e of shuffle([...bucket])) {
    if (used.has(keyOfEntry(e))) continue;
    (byOpener.get(e.opener) ?? byOpener.set(e.opener, []).get(e.opener)!).push(e);
  }
  const openers = shuffle([...byOpener.keys()]);
  const picked: Entry[] = [];
  let progress = true;
  while (picked.length < n && progress) {
    progress = false;
    for (const o of openers) {
      if (picked.length >= n) break;
      const list = byOpener.get(o)!;
      while (list.length) {
        const e = list.shift()!;
        if (used.has(keyOfEntry(e))) continue;
        used.add(keyOfEntry(e));
        picked.push(e);
        progress = true;
        break;
      }
    }
  }
  return picked;
}

/**
 * ロード済みノードから 20 問を生成 (純粋関数)。
 *   - バリューレイズ系 VALUE_QUOTA 問 + ブラフ/セミブラフ BLUFF_QUOTA 問を保証
 *   - 残りはコール/フォールド主体 (rest) からランダム抽選
 *   - 各バケット内はアグレッサーを round-robin で巡回してポジション分散
 *   - レイズ枠の確保を優先するため、フェーズ4 の「アグレッサー均等 4 問ずつ」制約は緩める
 */
export function buildBeginnerVsOpenQuestions(nodes: VsOpenNodes): BeginnerVsOpenQuestion[] {
  const entries = allEntries(nodes);
  const value = entries.filter((e) => isValueRaise(e.strategy));
  const bluff = entries.filter(
    (e) => !isValueRaise(e.strategy) && isBluffOrSemiBluffRaise(e.strategy, topPctOf(e.hand)),
  );
  const rest = entries.filter(
    (e) => !isValueRaise(e.strategy) && !isBluffOrSemiBluffRaise(e.strategy, topPctOf(e.hand)),
  );

  const used = new Set<string>();
  const picked: Entry[] = [];
  picked.push(...pickSpread(value, VALUE_QUOTA, used));
  picked.push(...pickSpread(bluff, BLUFF_QUOTA, used));
  picked.push(...pickSpread(rest, TOTAL_QUESTIONS - picked.length, used));
  // 念のためのフォールバック (プール枯渇時): 残り全候補から補充。
  if (picked.length < TOTAL_QUESTIONS) {
    picked.push(...pickSpread(entries, TOTAL_QUESTIONS - picked.length, used));
  }

  return shuffle(
    picked.map((e) => ({
      opener: e.opener,
      hero: e.hero,
      hand: e.hand,
      cards: handToCards(e.hand),
      strategy: e.strategy,
      nodeFile: vsOpenNodeFile(e.opener, e.hero),
    })),
  );
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
