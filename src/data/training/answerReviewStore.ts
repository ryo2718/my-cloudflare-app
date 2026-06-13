// 結果画面「答え一覧」/ 振り返り画面の汎用ローカル記録ストア (level.key キー)。
// in-memory + sessionStorage。DB には書き込まない (positionalRecordsStore と同方式)。
//
// 目的: 新モードのプレイ画面が finish() で AnswerReviewRecord[] を保存すれば、
//   結果画面 (TrainingResult) と振り返り画面 (TrainingReviewGeneric) が level.key 単位で
//   自動的に答え合わせを表示する。新モード追加時に結果/振り返り側の追加配線は不要。

import type { Hand, Position } from '../../types/strategy';

export interface AnswerReviewRecord {
  /** 1-indexed 出題順 (= 振り返り画面の index)。 */
  id: number;
  /** シナリオ pill 文言 (例: "HJ オープン" / "CO オープン → BB")。 */
  scenario: string;
  /** ハンド表記 (AA / AKs / 72o)。カード描画 (handToCards) に使う。 */
  hand: Hand;
  /** アニメ・レンジ表示用ノードファイル名 (例: utgr_bb.json / hj.json)。 */
  nodeFile: string;
  /** ActionTable のヒーロー席。 */
  mePosition: Position;
  /** 正解 (○) か不正解 (✕) か (= 獲得 pt > 0)。 */
  correct: boolean;
  /** ユーザー回答の表示文字列 (例: "30%" / "レイズ・コール" / "—")。 */
  userText: string;
  /** 正解の表示文字列 (例: "50%" / "レイズ")。 */
  correctText: string;
}

const STORAGE_KEY_PREFIX = 'answer_review:';
const mem = new Map<string, AnswerReviewRecord[]>();

function keyOf(levelKey: string): string {
  return STORAGE_KEY_PREFIX + levelKey;
}

function ss(): Storage | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

export function saveAnswerReview(levelKey: string, records: ReadonlyArray<AnswerReviewRecord>): void {
  mem.set(levelKey, [...records]);
  const s = ss();
  if (s) {
    try {
      s.setItem(keyOf(levelKey), JSON.stringify(records));
    } catch {
      /* quota 等は無視 */
    }
  }
}

export function loadAnswerReview(levelKey: string): AnswerReviewRecord[] | null {
  const m = mem.get(levelKey);
  if (m) return m;
  const s = ss();
  if (!s) return null;
  try {
    const raw = s.getItem(keyOf(levelKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnswerReviewRecord[];
    mem.set(levelKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function clearAnswerReview(levelKey: string): void {
  mem.delete(levelKey);
  const s = ss();
  if (s) {
    try {
      s.removeItem(keyOf(levelKey));
    } catch {
      /* ignore */
    }
  }
}
