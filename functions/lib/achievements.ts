// 実績解除判定 (サーバー側)。
//
// 実装している実績は 21 件 (ビギナー 3 + スタンダード 11 + プロフェッショナル 7)。
// マスター (whale_*) は未定義、 ロジックを置かない。
// すべて training_results.best_score の比較のみで判定 (追加クエリ不要)。
//
// achievement_id はクライアント側 master (src/data/achievements.ts) と一致させる。
//
// ビギナー (shrimp、 変更なし):
//   shrimp_1: training_results 1 行以上 / shrimp_2: preflop_beginner >= 20 / shrimp_3: SUM(total_attempts) >= 10
// スタンダード (fish): 初級90%(>=18) / 中級80%。
// プロフェッショナル (shark): 中級100%。 判定・記録のみ (ランクUI非表示)。
//
// ※ピン: preflop_beginner_open の best_score は 0-20 (正解数)。 90% = 18。

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

  const best = (t: string) => findRow(t)?.best_score ?? 0;

  // ビギナー (変更なし)。
  tryUnlock('shrimp_1', trainings.length > 0);
  tryUnlock('shrimp_2', best('preflop_beginner') >= 20);
  tryUnlock('shrimp_3', totalAttempts >= 10);

  // スタンダード (fish): 初級 90% (>=18) / 中級 80%。
  tryUnlock('fish_pf_open', best('preflop_beginner_open') >= 18);
  tryUnlock('fish_pf_vs_open', best('preflop_beginner_vs_open') >= 18);
  tryUnlock('fish_pf_vs_3bet_4bet', best('preflop_beginner_vs_3bet_4bet') >= 18);
  tryUnlock('fish_flop_beginner', best('flop_beginner') >= 18);
  tryUnlock('fish_pf_intermediate', best('preflop_intermediate') >= 32);
  tryUnlock('fish_pf_ep', best('preflop_intermediate_ep') >= 16);
  tryUnlock('fish_pf_lp', best('preflop_intermediate_lp') >= 16);
  tryUnlock('fish_pf_blind', best('preflop_intermediate_blind') >= 24);
  tryUnlock('fish_flop_srp_non_blind', best('srp_non_blind') >= 32);
  tryUnlock('fish_flop_srp_limp_blind', best('srp_limp_blind') >= 32);
  tryUnlock('fish_flop_3bp_4bp_5bp_non_blind', best('3bp_4bp_5bp_non_blind') >= 32);
  tryUnlock('fish_flop_3bp_4bp_5bp_blind', best('3bp_4bp_5bp_blind') >= 32);
  tryUnlock('fish_flop_donk_bmcb', best('donk_bmcb') >= 32);

  // プロフェッショナル (shark): 中級 100% (判定・記録のみ)。
  tryUnlock('shark_pf_intermediate', best('preflop_intermediate') >= 40);
  tryUnlock('shark_pf_ep', best('preflop_intermediate_ep') >= 20);
  tryUnlock('shark_pf_lp', best('preflop_intermediate_lp') >= 20);
  tryUnlock('shark_pf_blind', best('preflop_intermediate_blind') >= 30);
  tryUnlock('shark_flop_srp_non_blind', best('srp_non_blind') >= 40);
  tryUnlock('shark_flop_srp_limp_blind', best('srp_limp_blind') >= 40);
  tryUnlock('shark_flop_3bp_4bp_5bp_non_blind', best('3bp_4bp_5bp_non_blind') >= 40);
  tryUnlock('shark_flop_3bp_4bp_5bp_blind', best('3bp_4bp_5bp_blind') >= 40);
  tryUnlock('shark_flop_donk_bmcb', best('donk_bmcb') >= 40);

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
