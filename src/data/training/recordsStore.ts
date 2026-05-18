// トレーニング 20 問の回答記録ストア。
//
// 用途:
//   - TrainingPlay 完了時に 20 問の (問題 + 回答 + 正誤) を保存
//   - TrainingResult が「間違えた問題」セクション描画用に読み出し
//   - TrainingReview が個別の振り返り表示用に読み出し
//
// 永続性:
//   - in-memory (モジュールスコープ Map): 同セッション内のページ遷移で共有
//   - sessionStorage: ブラウザバック/リロードで in-memory が消えた場合のフォールバック
//   - localStorage は使わない (タブ閉じで揮発するのが望ましい)
//
// 鍵: training_records:{levelKey} (例: training_records:preflop_beginner)

import type { PreflopQuestion, CorrectAnswer } from './preflopBeginner';
import type { Action, IntermediateQuestion } from './preflopIntermediate';
import type { HandStrategy } from './preflopBeginner';

export interface ProblemRecord extends PreflopQuestion {
  /** 1〜20 (1-indexed)。出題順。 */
  id: number;
  /** プレイヤーの解答 ("participate" or "fold")。 */
  userAnswer: CorrectAnswer;
  /** 正解と一致するか。 */
  isCorrect: boolean;
}

/** 中級トレーニング用の問題記録。 */
export interface IntermediateRecord extends IntermediateQuestion {
  id: number;
  /** プレイヤーが選んだアクション (0-4 個)。 */
  selections: ReadonlyArray<Action>;
  /** タイマー切れで自動回答だった場合 true。 */
  timedOut: boolean;
  /** 基礎点合計 (floor 後)。 */
  rawScore: number;
  /** 正規化後の最終スコア (-1 / 0 / 1 / 2)。 */
  finalScore: number;
  /** 理論最高点 (>=5% の戦略を全部選んだ時の floor)。 */
  theoreticalMax: number;
  /** 振り返り用に保存する戦略 (= question.strategy と同じ、UI ロード簡略化)。 */
  strategySnapshot: HandStrategy;
}

const STORAGE_KEY_PREFIX = 'training_records:';

const memStore = new Map<string, ProblemRecord[]>();

function keyOf(levelKey: string): string {
  return STORAGE_KEY_PREFIX + levelKey;
}

function getSessionStorage(): Storage | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

export function saveRecords(levelKey: string, records: ReadonlyArray<ProblemRecord>): void {
  memStore.set(levelKey, [...records]);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(keyOf(levelKey), JSON.stringify(records));
  } catch {
    // quota / SecurityError 等を無視 (in-memory は維持)
  }
}

export function loadRecords(levelKey: string): ProblemRecord[] | null {
  const inMem = memStore.get(levelKey);
  if (inMem) return [...inMem];
  const ss = getSessionStorage();
  if (!ss) return null;
  try {
    const raw = ss.getItem(keyOf(levelKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProblemRecord[];
    // ロード後は in-memory にも展開 (次回 sync 読み込みを高速化)
    memStore.set(levelKey, parsed);
    return [...parsed];
  } catch {
    return null;
  }
}

export function clearRecords(levelKey: string): void {
  memStore.delete(levelKey);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.removeItem(keyOf(levelKey));
  } catch {
    // ignore
  }
}

/** 間違えた問題だけを抽出 (id 順)。 */
export function missedRecords(records: ReadonlyArray<ProblemRecord>): ProblemRecord[] {
  return records.filter((r) => !r.isCorrect);
}

// ---------------------------------------------------------------------------
// 中級用ストア (キーが衝突しないよう prefix を変える)
// ---------------------------------------------------------------------------

const INTERMEDIATE_KEY_PREFIX = 'training_records_intermediate:';
const memStoreIntermediate = new Map<string, IntermediateRecord[]>();

function intermediateKeyOf(levelKey: string): string {
  return INTERMEDIATE_KEY_PREFIX + levelKey;
}

export function saveIntermediateRecords(
  levelKey: string,
  records: ReadonlyArray<IntermediateRecord>,
): void {
  memStoreIntermediate.set(levelKey, [...records]);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(intermediateKeyOf(levelKey), JSON.stringify(records));
  } catch {
    // ignore
  }
}

export function loadIntermediateRecords(levelKey: string): IntermediateRecord[] | null {
  const inMem = memStoreIntermediate.get(levelKey);
  if (inMem) return [...inMem];
  const ss = getSessionStorage();
  if (!ss) return null;
  try {
    const raw = ss.getItem(intermediateKeyOf(levelKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntermediateRecord[];
    memStoreIntermediate.set(levelKey, parsed);
    return [...parsed];
  } catch {
    return null;
  }
}

export function clearIntermediateRecords(levelKey: string): void {
  memStoreIntermediate.delete(levelKey);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.removeItem(intermediateKeyOf(levelKey));
  } catch {
    // ignore
  }
}

/** 中級用「振り返り対象」= finalScore < 2 (満点以外)。 */
export function missedIntermediateRecords(
  records: ReadonlyArray<IntermediateRecord>,
): IntermediateRecord[] {
  return records.filter((r) => r.finalScore < 2);
}
