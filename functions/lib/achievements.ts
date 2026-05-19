// 実績解除判定 (サーバー側)。
//
// 実装している実績は 5 件 (ビギナー 3 + スタンダード 2)。
// プロフェッショナル / マスター (shark_*, whale_*) は未実装、 ロジックを置かない。
//
// achievement_id はクライアント側 master (src/data/achievements.ts) と一致させる。
//
//   shrimp_1: トレーニングモードを初めてプレイ        — training_results 1 行以上
//   shrimp_2: プリフロップ初級クリア (20/20)          — preflop_beginner best_score >= 20
//   shrimp_3: トレーニング 10 回以上プレイ            — SUM(total_attempts) >= 10
//   fish_1:   プリフロップ中級で正答率 50% 以上       — preflop_intermediate best_score >= 20
//   fish_2:   プリフロップ中級クリア (32pt, 80%)      — preflop_intermediate best_score >= 32

interface UnlockedRow {
  achievement_id: string;
}

interface TrainingRow {
  training_type: string;
  best_score: number;
  total_attempts: number;
}

/**
 * 指定 account の実績判定を行い、 新規アンロック分を DB に INSERT する。
 * 戻り値: 新規にアンロックされた achievement_id の配列 (差分のみ)。
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

  const trainingsRes = await db
    .prepare(
      'SELECT training_type, best_score, total_attempts FROM training_results WHERE account_id = ?',
    )
    .bind(accountId)
    .all<TrainingRow>();
  const trainings = trainingsRes.results ?? [];
  const findRow = (t: string) => trainings.find((r) => r.training_type === t);
  const totalAttempts = trainings.reduce((s, r) => s + r.total_attempts, 0);

  const newUnlocks: string[] = [];
  const tryUnlock = (id: string, cond: boolean) => {
    if (cond && !unlocked.has(id)) newUnlocks.push(id);
  };

  tryUnlock('shrimp_1', trainings.length > 0);

  const beginner = findRow('preflop_beginner');
  tryUnlock('shrimp_2', !!beginner && beginner.best_score >= 20);

  tryUnlock('shrimp_3', totalAttempts >= 10);

  const intermediate = findRow('preflop_intermediate');
  tryUnlock('fish_1', !!intermediate && intermediate.best_score >= 20);
  tryUnlock('fish_2', !!intermediate && intermediate.best_score >= 32);

  if (newUnlocks.length === 0) return [];

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
