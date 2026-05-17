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

export interface ProblemRecord extends PreflopQuestion {
  /** 1〜20 (1-indexed)。出題順。 */
  id: number;
  /** プレイヤーの解答 ("participate" or "fold")。 */
  userAnswer: CorrectAnswer;
  /** 正解と一致するか。 */
  isCorrect: boolean;
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
