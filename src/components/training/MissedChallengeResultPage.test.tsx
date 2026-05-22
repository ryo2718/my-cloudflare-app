// @vitest-environment jsdom
// フェーズ3: 挑戦モードの完了画面が「N問中M問正解」(正答率のみ) を表示する。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../test/ui';
import { saveChallengeResult } from './missedChallengeStore';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ sessionId: null }) }));

import { MissedChallengeResultPage } from './MissedChallengeResultPage';

beforeEach(() => {
  saveChallengeResult({
    level: 'beginner',
    total: 3,
    perfect_count: 2,
    items: [
      { missed_problem_id: 1, hand: 'AA', scenario_label: 'UTG オープン判定', final_score: 2, is_perfect: true },
      { missed_problem_id: 2, hand: 'KK', scenario_label: 'UTG オープン判定', final_score: 2, is_perfect: true },
      { missed_problem_id: 3, hand: '72o', scenario_label: 'UTG オープン判定', final_score: -1, is_perfect: false },
    ],
  });
});

describe('MissedChallengeResultPage 完了画面', () => {
  it('「N問中M問正解」と正答率・成績非反映の注記を表示する', () => {
    render(<MissedChallengeResultPage level="beginner" />);
    expect(screen.getByText('3問中 2問正解')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy(); // 2/3 = 67%
    expect(screen.getByText('※ 成績には反映されません')).toBeTruthy();
  });
});
