// プリフロップ初級「vs 3bet/4bet」モードの出題生成。
//   vs 3bet: 自分がオープン → 相手が 3bet → ヒーロー(=オープンした側)が判断するノード
//            ファイル {opener}r_{threebettor}r_{opener}.json  (hero = opener)
//   vs 4bet: 自分が 3bet → 相手が 4bet → ヒーロー(=3bettor)が判断するノード
//            ファイル {opener}r_{threebettor}r_{opener}r_{threebettor}.json  (hero = threebettor)
//
// 出題規則 (フェーズ2の preflopBeginnerExt を再利用):
//   - EV 閾値: topPct <= 40 (isEligibleByEvThreshold)
//   - 全戦略混合の除外: isAllMixedStrategy
//   - 「参加すらしていないハンド」除外: ノード JSON はレンジ内ハンドのみ収録のため、
//     Object.keys(hands) を辿るだけで自動的に除外される (27o vs 3bet 等は不在)。
//   - 強すぎるハンド除外 (シナリオ別):
//       vs 3bet → AA・KK を除外 (4bet ほぼ確定で自明)
//       vs 4bet → 除外なし (AA・KK も出題)
//   - 配分: vs3bet 12 : vs4bet 8。バリュー4 + ブラフ4 + 残り12 を保証。
//     ※ vs4bet にブラフ(混合5bet)はほぼ存在しないため、ブラフ枠は実質 vs3bet から確保。
// 採点は preflopBeginnerExt.scoreGentleSelect (0/1) を呼び出し側 (プレイ画面) で行う。

import { handToCards, type HandStrategy, type PreflopQuestion, VS_OPEN_PAIRS } from './preflopBeginner';
import { isEligibleByEvThreshold, isAllMixedStrategy, isValueRaise, isBluffOrSemiBluffRaise } from './preflopBeginnerExt';
import { EV_RANKING } from '../evRanking';
import type { Hand, Position } from '../../types/strategy';

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

export type VsRaiseKind = 'vs3bet' | 'vs4bet';

/** 簡単すぎるため vs 3bet で出題しないハンド (vs 4bet では出題する)。 */
export const VS3BET_EXCLUDED_HANDS: ReadonlyArray<Hand> = ['AA', 'KK'] as Hand[];

/** 全出題数 / シナリオ配分 / レイズ枠。 */
export const TOTAL_QUESTIONS = 20;
export const VS3BET_TARGET = 12;
export const VS4BET_TARGET = 8;
export const VALUE_QUOTA = 4;
export const BLUFF_QUOTA = 4;

export interface BeginnerVs3Bet4BetQuestion {
  kind: VsRaiseKind;
  /** RFI (オープン) ポジション。 */
  opener: Position;
  /** 3bet したポジション。 */
  threebettor: Position;
  /** 判断するヒーロー (vs3bet=opener / vs4bet=threebettor)。 */
  hero: Position;
  hand: Hand;
  cards: PreflopQuestion['cards'];
  /** 該当ハンドの GTO 戦略 (採点・レンジ表示用)。 */
  strategy: HandStrategy;
  /** アニメ・レンジ表示用ノードファイル名。 */
  nodeFile: string;
}

/** ロード済みノード 1 件。 */
export interface LoadedNode {
  kind: VsRaiseKind;
  opener: Position;
  threebettor: Position;
  hands: Record<string, HandStrategy>;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** ノードファイル名。 */
export function vs3betNodeFile(opener: Position, threebettor: Position): string {
  const o = opener.toLowerCase();
  const b = threebettor.toLowerCase();
  return `${o}r_${b}r_${o}.json`;
}
export function vs4betNodeFile(opener: Position, threebettor: Position): string {
  const o = opener.toLowerCase();
  const b = threebettor.toLowerCase();
  return `${o}r_${b}r_${o}r_${b}.json`;
}

function topPctOf(hand: Hand): number {
  return EV_RANKING[hand]?.topPct ?? 999;
}

/** あるシナリオの出題候補ハンド (EV<=40 / 非混合 / vs3betはAA・KK除外)。 */
export function candidatesFor(kind: VsRaiseKind, hands: Record<string, HandStrategy>): Hand[] {
  const out: Hand[] = [];
  for (const h of Object.keys(hands) as Hand[]) {
    if (!isEligibleByEvThreshold(h)) continue;
    if (kind === 'vs3bet' && VS3BET_EXCLUDED_HANDS.includes(h)) continue;
    if (isAllMixedStrategy(hands[h])) continue;
    out.push(h);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 内部: 候補エントリと選択
// ---------------------------------------------------------------------------

interface Entry {
  kind: VsRaiseKind;
  opener: Position;
  threebettor: Position;
  hero: Position;
  hand: Hand;
  strategy: HandStrategy;
  nodeFile: string;
}

function nodeFileOf(kind: VsRaiseKind, opener: Position, threebettor: Position): string {
  return kind === 'vs3bet' ? vs3betNodeFile(opener, threebettor) : vs4betNodeFile(opener, threebettor);
}

function allEntries(nodes: ReadonlyArray<LoadedNode>): Entry[] {
  const out: Entry[] = [];
  for (const n of nodes) {
    const hero = n.kind === 'vs3bet' ? n.opener : n.threebettor;
    const nodeFile = nodeFileOf(n.kind, n.opener, n.threebettor);
    for (const hand of candidatesFor(n.kind, n.hands)) {
      out.push({ kind: n.kind, opener: n.opener, threebettor: n.threebettor, hero, hand, strategy: n.hands[hand], nodeFile });
    }
  }
  return out;
}

const keyOfEntry = (e: Entry): string => `${e.nodeFile}:${e.hand}`;

/** バケットから n 個を opener round-robin で選ぶ (ポジション分散)。 */
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

function toQuestion(e: Entry): BeginnerVs3Bet4BetQuestion {
  return {
    kind: e.kind,
    opener: e.opener,
    threebettor: e.threebettor,
    hero: e.hero,
    hand: e.hand,
    cards: handToCards(e.hand),
    strategy: e.strategy,
    nodeFile: e.nodeFile,
  };
}

/**
 * ロード済みノードから 20 問を生成 (純粋関数)。
 *   - バリュー VALUE_QUOTA + ブラフ BLUFF_QUOTA を保証 (両シナリオ・ポジション分散)
 *   - 残りで vs3bet:vs4bet = 12:8 を満たすよう補充 (両シナリオ必ず出題)
 */
export function buildBeginnerVs3Bet4BetQuestions(nodes: ReadonlyArray<LoadedNode>): BeginnerVs3Bet4BetQuestion[] {
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

  // 残りで vs3bet:vs4bet = 12:8 に近づける。
  const count = (k: VsRaiseKind) => picked.filter((p) => p.kind === k).length;
  const need3 = Math.max(0, VS3BET_TARGET - count('vs3bet'));
  const need4 = Math.max(0, VS4BET_TARGET - count('vs4bet'));
  picked.push(...pickSpread(rest.filter((e) => e.kind === 'vs3bet'), need3, used));
  picked.push(...pickSpread(rest.filter((e) => e.kind === 'vs4bet'), need4, used));

  // フォールバック (片シナリオのプール枯渇時): 残り全候補から補充。
  if (picked.length < TOTAL_QUESTIONS) {
    picked.push(...pickSpread(rest, TOTAL_QUESTIONS - picked.length, used));
  }
  if (picked.length < TOTAL_QUESTIONS) {
    picked.push(...pickSpread(entries, TOTAL_QUESTIONS - picked.length, used));
  }

  return shuffle(picked.map(toQuestion));
}

/** 全 30 ノード (15 vs3bet + 15 vs4bet) を fetch して 20 問を生成。 */
export async function generateBeginnerVs3Bet4BetQuestions(): Promise<BeginnerVs3Bet4BetQuestion[]> {
  const loaded: LoadedNode[] = [];
  await Promise.all(
    VS_OPEN_PAIRS.flatMap(([opener, threebettor]) =>
      (['vs3bet', 'vs4bet'] as VsRaiseKind[]).map(async (kind) => {
        try {
          const file = nodeFileOf(kind, opener, threebettor);
          const res = await fetch(`${PREFLOP_DATA_ROOT}/${file}`);
          if (!res.ok) return;
          const raw = (await res.json()) as { hands?: Record<string, HandStrategy> };
          if (raw.hands) loaded.push({ kind, opener, threebettor, hands: raw.hands });
        } catch {
          /* 1 ファイル失敗は skip */
        }
      }),
    ),
  );
  return buildBeginnerVs3Bet4BetQuestions(loaded);
}
