// 挑戦モード (MissedChallengePlayPage) の不変条件をソース走査で担保するテスト。
// 対話的レンダリング基盤 (jsdom) が無いため、即時フィードバック搭載後も以下を守ることを
// ソースレベルで検証する:
//   - DB 記録をしない (training_results / problem_attempts / missed_problems を書かない)
//   - タイマーを持たない (Countdown / setInterval / timeLimitSec 無し)
//   - 即時フィードバックは共通部品を再利用し、共通トグルに従う

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(process.cwd(), 'src/components/training/MissedChallengePlayPage.tsx'),
  'utf8',
);

describe('MissedChallengePlayPage 不変条件', () => {
  it('記録しない: DB 書き込み API を呼ばない', () => {
    expect(SRC).not.toContain('apiPostMissedProblems');
    expect(SRC).not.toContain('apiPostProblemAttempts');
    expect(SRC).not.toContain('apiPostTrainingResult');
  });

  it('タイマーなし: Countdown / setInterval / timeLimitSec を持たない', () => {
    expect(SRC).not.toContain('Countdown');
    expect(SRC).not.toContain('setInterval');
    expect(SRC).not.toContain('timeLimitSec');
  });

  it('即時フィードバックは共通部品を再利用し共通トグルに従う', () => {
    expect(SRC).toContain('InstantFeedback');
    expect(SRC).toContain('NodeRangeSection');
    expect(SRC).toContain('loadInstantFeedback');
    // トグル ON のときだけフィードバックを出すゲートがある。
    expect(SRC).toContain('if (instant)');
  });

  it('完了処理は sessionStorage の挑戦結果保存のみ (saveChallengeResult)', () => {
    expect(SRC).toContain('saveChallengeResult');
  });
});
