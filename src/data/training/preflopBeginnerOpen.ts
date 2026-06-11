// プリフロップ初級「オープン」モードの出題生成。
//   各ポジション (UTG/HJ/CO/BTN/SB) の open ノード ({pos}.json) を読み、
//   「このハンドを何%でレイズ(オープン)するか」をスライダーで答える問題を 20 問生成。
//
// 出題規則 (フェーズ2の preflopBeginnerExt を使用):
//   - EV 閾値: topPct <= 40 のハンドのみ候補
//   - SB: レイズ90%以上のハンドのみ (リンプ/レイズ混合は出さない)
//   - 境界 (レイズ混合 10-90%) 問題は全体で最大 4 問 (20%)
//   - ポジション均等配分: 各 4 問 = 20 問
// 採点は preflopBeginnerExt.scoreGentleSlider (±20%) を呼び出し側 (プレイ画面) で行う。

import { handToCards, type HandStrategy, type PreflopQuestion } from './preflopBeginner';
import { isEligibleByEvThreshold, isRaiseDominant, isBoundary } from './preflopBeginnerExt';
import type { Hand, Position } from '../../types/strategy';

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

/** 出題するポジション (open = RFI)。 */
export const OPEN_POSITIONS: ReadonlyArray<Position> = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
/** 1 ポジションあたりの出題数 (均等配分 = 20 問)。 */
export const PER_POSITION = 4;
/** 境界 (レイズ混合) 問題の全体上限 (= 20%)。 */
export const MAX_BOUNDARY = 4;
/** SB で出題対象とする最低レイズ頻度。 */
export const SB_RAISE_MIN = 90;

export interface BeginnerOpenQuestion {
  /** ヒーロー (= オープンするポジション)。 */
  position: Position;
  hand: Hand;
  cards: PreflopQuestion['cards'];
  /** GTO レイズ頻度 (スライダー正解値, 0-100)。 */
  raisePct: number;
  /** アニメ・レンジ表示用ノードファイル名 ({pos}.json)。 */
  nodeFile: string;
  /** 境界 (レイズ混合) 問題か。 */
  boundary: boolean;
}

export type NodesByPosition = Partial<Record<Position, Record<string, HandStrategy>>>;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** あるポジションの出題候補ハンド (EV<=40。SB は追加で raise>=90)。 */
export function candidatesFor(pos: Position, hands: Record<string, HandStrategy>): Hand[] {
  const out: Hand[] = [];
  for (const h of Object.keys(hands) as Hand[]) {
    if (!isEligibleByEvThreshold(h)) continue;
    if (pos === 'SB' && !isRaiseDominant(hands[h], SB_RAISE_MIN)) continue;
    out.push(h);
  }
  return out;
}

/** ロード済みノードから 20 問を生成 (純粋関数)。 */
export function buildBeginnerOpenQuestions(nodes: NodesByPosition): BeginnerOpenQuestion[] {
  const out: BeginnerOpenQuestion[] = [];
  let boundaryCount = 0;
  for (const pos of OPEN_POSITIONS) {
    const hands = nodes[pos];
    if (!hands) continue;
    const pool = shuffle(candidatesFor(pos, hands));
    let taken = 0;
    for (const h of pool) {
      if (taken >= PER_POSITION) break;
      const s = hands[h];
      const b = isBoundary(s);
      if (b && boundaryCount >= MAX_BOUNDARY) continue; // 境界キャップ超過は非境界で埋める
      out.push({
        position: pos,
        hand: h,
        cards: handToCards(h),
        raisePct: s.raise ?? 0,
        nodeFile: `${pos.toLowerCase()}.json`,
        boundary: b,
      });
      if (b) boundaryCount++;
      taken++;
    }
  }
  return shuffle(out);
}

/** ノードを fetch して 20 問を生成。 */
export async function generateBeginnerOpenQuestions(): Promise<BeginnerOpenQuestion[]> {
  const nodes: NodesByPosition = {};
  await Promise.all(
    OPEN_POSITIONS.map(async (pos) => {
      try {
        const res = await fetch(`${PREFLOP_DATA_ROOT}/${pos.toLowerCase()}.json`);
        if (!res.ok) return;
        const raw = (await res.json()) as { hands?: Record<string, HandStrategy> };
        if (raw.hands) nodes[pos] = raw.hands;
      } catch {
        /* 1 ファイル失敗は skip */
      }
    }),
  );
  return buildBeginnerOpenQuestions(nodes);
}
