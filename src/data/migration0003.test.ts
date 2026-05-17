import { describe, it, expect } from 'vitest';
// Vite の ?raw インポートで SQL を string として読む (fs / __dirname 不要)
import sql from '../../migrations/0003_account_extras.sql?raw';

describe('migrations/0003_account_extras.sql', () => {
  it('accounts.points 列を ALTER TABLE で追加', () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+accounts\s+ADD\s+COLUMN\s+points\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  });

  it('training_results テーブルを定義', () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+training_results/i);
  });

  it('account_id への外部キー指定', () => {
    expect(sql).toMatch(/FOREIGN\s+KEY\s*\(\s*account_id\s*\)\s+REFERENCES\s+accounts/i);
  });

  it('idx_training_results_account インデックス定義', () => {
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_training_results_account/i);
  });

  it('training_type / score / completed_at 必須カラム', () => {
    expect(sql).toMatch(/training_type\s+TEXT\s+NOT\s+NULL/i);
    expect(sql).toMatch(/score\s+INTEGER\s+NOT\s+NULL/i);
    expect(sql).toMatch(/completed_at\s+INTEGER\s+NOT\s+NULL/i);
  });
});
