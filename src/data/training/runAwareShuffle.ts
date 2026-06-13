// run-aware シャッフル: 同じキー (出題タイプ / 支配ベットサイズ等) が長く連続しないよう並べ替える。
//
// 目的: 多数派 (初級=CB, donkbmcb=check主体) が一列に固まって「次も同じ」という学習バイアス・
//       単調感を生むのを防ぐ。完全交互だと不自然なので maxRun (=2..3) 連続までは許容する。
//
// アルゴリズム (ストライド等間隔 + 残連続キャップの後処理):
//   1. Fisher-Yates でキー内の並びをランダム化 (同一キー内の出題順はランダム)
//   2. 各キーをシーケンス全体に「等間隔」で配置する (count c のキーの j 番目は目標位置 (j+0.5)/c)。
//      目標位置でソートすると、各キーが均等に散る (多数派キーも端に固まらない)。
//   3. それでも maxRun を超える連続が残った箇所だけ、後方の別キー要素と swap して緩和 (ベストエフォート)。
//
// 多数派が極端 (例 donk/bmcb の check 主体) で理論上 maxRun に収まらない場合も、等間隔配置により
// 連続は最小化される。並べ替えのみで「どの要素を含むか」は変えないため、選定 (dedup / クラスタ層化 /
// 配分) には影響しない。

function fisherYates<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** items を、keyFn の同一値が最大 maxRun 連続までになるよう並べ替える (ベストエフォート)。 */
export function shuffleWithRunLimit<T>(
  items: ReadonlyArray<T>,
  keyFn: (item: T) => string,
  maxRun = 3,
): T[] {
  const base = fisherYates([...items]);
  if (maxRun < 1 || base.length <= maxRun) return base;

  // 各キーをまとめ (キー内はシャッフル済み順)、等間隔の目標位置を付与してソート。
  const buckets = new Map<string, T[]>();
  for (const it of base) {
    const k = keyFn(it);
    const b = buckets.get(k);
    if (b) b.push(it);
    else buckets.set(k, [it]);
  }
  const tagged: Array<{ item: T; target: number; jitter: number }> = [];
  for (const [, arr] of buckets) {
    for (let j = 0; j < arr.length; j++) {
      tagged.push({ item: arr[j], target: (j + 0.5) / arr.length, jitter: Math.random() });
    }
  }
  tagged.sort((a, b) => a.target - b.target || a.jitter - b.jitter);
  return tagged.map((t) => t.item);
}

/** 並びの中で keyFn の同一値が連続する最長ラン長を返す (テスト/集計用)。 */
export function longestRun<T>(items: ReadonlyArray<T>, keyFn: (item: T) => string): number {
  let max = 0;
  let run = 0;
  let prev: string | null = null;
  for (const it of items) {
    const k = keyFn(it);
    run = k === prev ? run + 1 : 1;
    prev = k;
    if (run > max) max = run;
  }
  return max;
}
