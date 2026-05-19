// 実績解除判定 (サーバー側)。
//
// achievement_id はクライアント側 master (src/data/achievements.ts) と一致させる文字列。
// 判定は account_id を基準に DB をクエリ、 未アンロックの実績だけ INSERT OR IGNORE。
//
// 仮設定の実績一覧 (ユーザー側 spec に従う):
//   shrimp_1: トレーニングモードをプレイ           (training_results に 1 行以上)
//   shrimp_2: 初級モードをクリア (20/20)            (preflop_beginner best_score >= 20)
//   shrimp_3: トータル 10 回到達                    (SUM(total_attempts) >= 10)
//   fish_1:   中級モードをプレイ                    (preflop_intermediate row 存在)
//   fish_2:   中級モードで 20pt 以上獲得            (preflop_intermediate best_score >= 20)
//   fish_3:   中級モードで 30pt 以上獲得            (preflop_intermediate best_score >= 30)
//   shark_1:  中級モードで 40pt (満点) 獲得          (preflop_intermediate best_score >= 40)
//   shark_2:  全ポジション正答率 80% 以上            (problem_attempts ベース、 6 ポジ全部)
//   shark_3:  7 日連続トレーニング                   (problem_attempts.created_at 連続日数)
//   whale_1:  中級満点 3 回                          (training_results の best_score=40 (上限) を 3 回… ただし
//                                                    total_attempts のカウントは複数試行を含むため、 spec のとおり
//                                                    「best_score>=40 を維持して total_attempts 3 以上」で近似)
//   whale_2:  シーズン王者 (1 シーズンランキング 1 位)  → 別途オフライン or 手動 (今回は判定なし)
//   whale_3:  累計 500pt 達成                        (SUM(best_score * points_per_q) >= 500)
//
// points_per_q (中級は 2pt/問、 初級は 1pt/問) はクライアント側カタログ準拠。
// サーバー側は同じレート (intermediate=2, beginner=1) で計算する。

export interface AccountForCheck {
  id: number;
}

interface UnlockedRow {
  achievement_id: string;
}

interface TrainingRow {
  training_type: string;
  best_score: number;
  total_attempts: number;
}

interface PositionRow {
  hero_position: string;
  score_sum: number;
  max_sum: number;
}

interface DayRow {
  /** 'YYYY-MM-DD' (JST 換算)。 */
  day: string;
}

const ALL_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

function pointsPerQ(trainingType: string): number {
  return trainingType === 'preflop_intermediate' ? 2 : 1;
}

/**
 * 指定 account の実績判定を行い、新規アンロック分を DB に INSERT する。
 * 戻り値: 新規にアンロックされた achievement_id の配列 (既存 + 新規ではなく差分のみ)。
 */
export async function evaluateAchievements(
  db: D1Database,
  accountId: number,
): Promise<string[]> {
  const unlockedRes = await db
    .prepare('SELECT achievement_id FROM user_achievements WHERE account_id = ?')
    .bind(accountId)
    .all<UnlockedRow>();
  const unlocked = new Set((unlockedRes.results ?? []).map((r) => r.achievement_id));

  // 必要なデータをまとめて取得
  const trainingsRes = await db
    .prepare(
      'SELECT training_type, best_score, total_attempts FROM training_results WHERE account_id = ?',
    )
    .bind(accountId)
    .all<TrainingRow>();
  const trainings = trainingsRes.results ?? [];
  const findRow = (t: string) => trainings.find((r) => r.training_type === t);
  const totalAttempts = trainings.reduce((s, r) => s + r.total_attempts, 0);
  const totalPoints = trainings.reduce(
    (s, r) => s + r.best_score * pointsPerQ(r.training_type),
    0,
  );

  const newUnlocks: string[] = [];
  const tryUnlock = (id: string, cond: boolean) => {
    if (cond && !unlocked.has(id)) newUnlocks.push(id);
  };

  tryUnlock('shrimp_1', trainings.length > 0);

  const beginner = findRow('preflop_beginner');
  tryUnlock('shrimp_2', !!beginner && beginner.best_score >= 20);

  tryUnlock('shrimp_3', totalAttempts >= 10);

  const intermediate = findRow('preflop_intermediate');
  tryUnlock('fish_1', !!intermediate && intermediate.total_attempts > 0);
  tryUnlock('fish_2', !!intermediate && intermediate.best_score >= 20);
  tryUnlock('fish_3', !!intermediate && intermediate.best_score >= 30);
  tryUnlock('shark_1', !!intermediate && intermediate.best_score >= 40);

  // shark_2: 全ポジ正答率 80% 以上
  if (!unlocked.has('shark_2')) {
    const posRes = await db
      .prepare(
        `SELECT hero_position,
                SUM(CASE WHEN score_obtained >= 2 THEN 2
                         WHEN score_obtained = 1 THEN 1
                         ELSE 0 END) AS score_sum,
                SUM(CASE WHEN training_type = 'preflop_intermediate' THEN 2 ELSE 1 END) AS max_sum
         FROM problem_attempts WHERE account_id = ?
         GROUP BY hero_position`,
      )
      .bind(accountId)
      .all<PositionRow>();
    const map = new Map<string, PositionRow>();
    for (const r of posRes.results ?? []) map.set(r.hero_position, r);
    const allOk = ALL_POSITIONS.every((p) => {
      const r = map.get(p);
      if (!r || r.max_sum === 0) return false;
      return r.score_sum / r.max_sum >= 0.8;
    });
    if (allOk) newUnlocks.push('shark_2');
  }

  // shark_3: 7 日連続トレーニング (JST 日付ベース)
  if (!unlocked.has('shark_3')) {
    const daysRes = await db
      .prepare(
        // created_at は ms epoch。 JST に換算 (+9h) して 'YYYY-MM-DD' に切り出す。
        `SELECT DISTINCT strftime('%Y-%m-%d', datetime((created_at + 9*3600*1000) / 1000, 'unixepoch')) AS day
         FROM problem_attempts WHERE account_id = ?
         ORDER BY day ASC`,
      )
      .bind(accountId)
      .all<DayRow>();
    const days = (daysRes.results ?? []).map((r) => r.day);
    if (hasConsecutiveDays(days, 7)) newUnlocks.push('shark_3');
  }

  // whale_1: 中級 best_score 40 を維持しつつ試行 3 回以上
  tryUnlock(
    'whale_1',
    !!intermediate && intermediate.best_score >= 40 && intermediate.total_attempts >= 3,
  );

  // whale_2: シーズン王者 — 自動判定不可、後日手動 INSERT 想定 (今回は判定スキップ)
  // (TODO: シーズン終了時のジョブで決定)

  tryUnlock('whale_3', totalPoints >= 500);

  if (newUnlocks.length === 0) return [];

  // 新規アンロックを bulk INSERT (INSERT OR IGNORE で UNIQUE 制約衝突を吸収)。
  const now = Date.now();
  for (const id of newUnlocks) {
    await db
      .prepare(
        'INSERT OR IGNORE INTO user_achievements (account_id, achievement_id, unlocked_at) VALUES (?, ?, ?)',
      )
      .bind(accountId, id, now)
      .run();
  }
  return newUnlocks;
}

/** 'YYYY-MM-DD' のソート済み配列に N 日連続が含まれるか。 */
function hasConsecutiveDays(days: string[], n: number): boolean {
  if (days.length < n) return false;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (isNextDay(days[i - 1], days[i])) {
      run += 1;
      if (run >= n) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

function isNextDay(prev: string, curr: string): boolean {
  const pd = Date.parse(prev + 'T00:00:00Z');
  const cd = Date.parse(curr + 'T00:00:00Z');
  if (!Number.isFinite(pd) || !Number.isFinite(cd)) return false;
  return cd - pd === 24 * 3600 * 1000;
}
