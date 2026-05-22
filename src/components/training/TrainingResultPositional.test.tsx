// @vitest-environment jsdom
// フェーズ3: 完了画面に得点・達成率が表示される (中級ポジショナル)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../test/ui';
import type { TrainingLevel } from '../../data/trainingCatalog';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ sessionId: null }) }));

import { TrainingResultPositional } from './TrainingResultPositional';

const LEVEL: TrainingLevel = {
  key: 'preflop_intermediate_ep',
  label: '中級 EP',
  points: 1,
  questionCount: 20,
  timeLimitSec: 'none',
  implemented: true,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response));
  window.history.pushState({}, '', '/training/preflop_intermediate_ep/result?score=2&total=20&mode=positional');
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingResultPositional 完了画面', () => {
  it('得点 (2/20) と達成率 (10%) を表示する', () => {
    render(<TrainingResultPositional level={LEVEL} />);
    expect(screen.getByText('お疲れさまでした!')).toBeTruthy();
    expect(screen.getByText('2/20')).toBeTruthy();
    expect(screen.getByText('達成率')).toBeTruthy();
    expect(screen.getByText('10%')).toBeTruthy();
  });
});
