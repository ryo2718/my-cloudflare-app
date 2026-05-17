import { describe, it, expect } from 'vitest';
import sql from '../../migrations/0004_training_results_v2.sql?raw';

describe('migrations/0004_training_results_v2.sql', () => {
  it('既存 training_results を DROP', () => {
    expect(sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+training_results/i);
  });

  it('新 training_results テーブルを定義', () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+training_results/i);
  });

  it('best_score / best_score_at / total_attempts / updated_at 必須カラム', () => {
    expect(sql).toMatch(/best_score\s+INTEGER\s+NOT\s+NULL/i);
    expect(sql).toMatch(/best_score_at\s+INTEGER\s+NOT\s+NULL/i);
    expect(sql).toMatch(/total_attempts\s+INTEGER\s+NOT\s+NULL/i);
    expect(sql).toMatch(/updated_at\s+INTEGER\s+NOT\s+NULL/i);
  });

  it('UNIQUE(account_id, training_type) 制約', () => {
    expect(sql).toMatch(/UNIQUE\s*\(\s*account_id\s*,\s*training_type\s*\)/i);
  });

  it('account_id への外部キー', () => {
    expect(sql).toMatch(/FOREIGN\s+KEY\s*\(\s*account_id\s*\)\s+REFERENCES\s+accounts/i);
  });

  it('idx_training_results_account インデックス', () => {
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_training_results_account/i);
  });

  it('旧スキーマの score / completed_at カラムは含まれない (置き換え)', () => {
    // 新 schema 内の本文で `score INTEGER` のような旧定義が無いこと
    expect(sql).not.toMatch(/\bscore\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0,\s*$/im);
    expect(sql).not.toMatch(/\bcompleted_at\s+INTEGER\s+NOT\s+NULL/i);
  });
});
