// evaluateAchievements の発火判定テスト (training_results.best_score の境界値)。
// SELECT 結果を注入できる軽量 D1 スタブを使う (fakeDb は all() が空のため別実装)。

import { describe, it, expect } from 'vitest';
import { evaluateAchievements } from './achievements';

interface TrainingRow { training_type: string; best_score: number; total_attempts: number }

/** training_results / user_achievements の SELECT 結果を注入し、 INSERT された id を記録する D1 スタブ。 */
function stubDb(trainings: TrainingRow[], unlocked: string[] = []) {
  const inserted: string[] = [];
  function bound(sql: string, args: unknown[]) {
    return {
      bind: (...a: unknown[]) => bound(sql, a),
      all: async () => {
        if (sql.includes('FROM user_achievements')) {
          return { results: unlocked.map((id) => ({ achievement_id: id })), success: true };
        }
        if (sql.includes('FROM training_results')) {
          return { results: trainings, success: true };
        }
        return { results: [], success: true };
      },
      run: async () => {
        if (sql.includes('INSERT INTO user_achievements')) inserted.push(args[1] as string);
        return { success: true };
      },
    };
  }
  const db = { prepare: (sql: string) => bound(sql, []) } as unknown as D1Database;
  return { db, inserted };
}

const row = (training_type: string, best_score: number, total_attempts = 1): TrainingRow => ({
  training_type,
  best_score,
  total_attempts,
});

describe('evaluateAchievements (再設計後)', () => {
  it('記録なし → 何も解除しない', async () => {
    const { db } = stubDb([]);
    expect(await evaluateAchievements(db, 1)).toEqual([]);
  });

  it('ビギナー: 1 行で shrimp_1、 初級20で shrimp_2、 累計10で shrimp_3', async () => {
    const { db } = stubDb([row('preflop_beginner', 20, 10)]);
    const got = await evaluateAchievements(db, 1);
    expect(got).toContain('shrimp_1');
    expect(got).toContain('shrimp_2');
    expect(got).toContain('shrimp_3');
  });

  it('初級基礎 19 では shrimp_2 未解除 (20 必須)', async () => {
    const { db } = stubDb([row('preflop_beginner', 19, 1)]);
    expect(await evaluateAchievements(db, 1)).not.toContain('shrimp_2');
  });

  it('⚠️ オープン: best_score 18 で fish_pf_open 解除 / 17 では未解除 / 9 でも未解除', async () => {
    expect(await evaluateAchievements(stubDb([row('preflop_beginner_open', 18)]).db, 1)).toContain('fish_pf_open');
    expect(await evaluateAchievements(stubDb([row('preflop_beginner_open', 17)]).db, 1)).not.toContain('fish_pf_open');
    // 誤って 9 (= maxScoreFor 10 の 90%) で発火しないこと
    expect(await evaluateAchievements(stubDb([row('preflop_beginner_open', 9)]).db, 1)).not.toContain('fish_pf_open');
  });

  it('スタンダード 中級 80% 境界: intermediate 32→fish / 31→未', async () => {
    expect(await evaluateAchievements(stubDb([row('preflop_intermediate', 32)]).db, 1)).toContain('fish_pf_intermediate');
    expect(await evaluateAchievements(stubDb([row('preflop_intermediate', 31)]).db, 1)).not.toContain('fish_pf_intermediate');
  });

  it('スタンダード 各モード境界 (中級フロップ5モードは 32/40 で解除)', async () => {
    const got = await evaluateAchievements(stubDb([
      row('preflop_intermediate_ep', 16),
      row('preflop_intermediate_lp', 16),
      row('preflop_intermediate_blind', 24),
      row('flop_beginner', 18),
      row('srp_non_blind', 32),
      row('srp_limp_blind', 32),
      row('3bp_4bp_5bp_non_blind', 32),
      row('3bp_4bp_5bp_blind', 32),
      row('donk_bmcb', 32),
      row('preflop_beginner_vs_open', 18),
      row('preflop_beginner_vs_3bet_4bet', 18),
    ]).db, 1);
    for (const id of ['fish_pf_ep', 'fish_pf_lp', 'fish_pf_blind', 'fish_flop_beginner', 'fish_flop_srp_non_blind', 'fish_flop_srp_limp_blind', 'fish_flop_3bp_4bp_5bp_non_blind', 'fish_flop_3bp_4bp_5bp_blind', 'fish_flop_donk_bmcb', 'fish_pf_vs_open', 'fish_pf_vs_3bet_4bet']) {
      expect(got).toContain(id);
    }
  });

  it('プロ 中級100% 境界: intermediate 40→shark / 39→未 (fish は解除済み)', async () => {
    const got40 = await evaluateAchievements(stubDb([row('preflop_intermediate', 40)]).db, 1);
    expect(got40).toContain('shark_pf_intermediate');
    expect(got40).toContain('fish_pf_intermediate');
    const got39 = await evaluateAchievements(stubDb([row('preflop_intermediate', 39)]).db, 1);
    expect(got39).not.toContain('shark_pf_intermediate');
    expect(got39).toContain('fish_pf_intermediate');
  });

  it('プロ フロップ100%: srp_non_blind 40→shark / 39→未', async () => {
    expect(await evaluateAchievements(stubDb([row('srp_non_blind', 40)]).db, 1)).toContain('shark_flop_srp_non_blind');
    expect(await evaluateAchievements(stubDb([row('srp_non_blind', 39)]).db, 1)).not.toContain('shark_flop_srp_non_blind');
  });

  it('既にアンロック済みの実績は再解除しない (差分のみ)', async () => {
    const { db } = stubDb([row('preflop_beginner', 20, 1)], ['shrimp_1', 'shrimp_2']);
    const got = await evaluateAchievements(db, 1);
    expect(got).not.toContain('shrimp_1');
    expect(got).not.toContain('shrimp_2');
  });
});
