// 結果保存 (apiSubmitTrainingResult) が失敗したときにスコアを退避し、
// 再試行 / 再ログイン後に再送するための localStorage ストア。
//
// 点数 (best_score / 累計pt / ランキング) は best_score = max(既存, 今回) 由来で冪等のため、
// 同じスコアを再送しても二重加算は起きない (total_attempts のみ +1)。退避は「保存に失敗した分」だけ、
// 再送成功で破棄する。同 training_type は最新スコアで置き換え (重複退避を防ぐ)。

const STORAGE_KEY = 'pending_training_results';

export interface PendingResult {
  training_type: string;
  score: number;
  savedAt: number;
}

function readAll(): PendingResult[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is PendingResult =>
        !!x && typeof x.training_type === 'string' && typeof x.score === 'number',
    );
  } catch {
    return [];
  }
}

function writeAll(list: ReadonlyArray<PendingResult>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (list.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota / serialization errors
  }
}

/** 保存失敗したスコアを退避 (同 training_type は最新で置き換え)。 */
export function savePendingResult(p: { training_type: string; score: number }): void {
  const list = readAll().filter((x) => x.training_type !== p.training_type);
  list.push({ training_type: p.training_type, score: p.score, savedAt: Date.now() });
  writeAll(list);
}

/** 退避中のスコア一覧。 */
export function loadPendingResults(): PendingResult[] {
  return readAll();
}

/** 指定 training_type の退避を破棄 (再送成功時)。 */
export function clearPendingResult(trainingType: string): void {
  writeAll(readAll().filter((x) => x.training_type !== trainingType));
}

/** テスト用に全消去。 */
export function __clearAllPendingResults(): void {
  writeAll([]);
}
