// @vitest-environment jsdom
// 回帰: 空アクション履歴 (UTG open 等) の問題が同一 file で連続したとき、2問目でも
// カウントダウンが表示されること。
//
// 旧実装では animReady のリセットを親 useTrainingHarness の useEffect で行っていたため、
// 子 ActionTable が空 items のとき effect 内で同期に呼ぶ onAnimationDone()
// (= setAnimReady(true)) が、子→親の effect 実行順で親の setAnimReady(false) に
// 上書きされ、2問目でカウントダウンが二度と出なかった。
// animReady をレンダー中リセットに変えたことで、この上書きが起きないことを確認する。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import type { PositionalQuestion } from '../../data/training/preflopIntermediatePositional';
import type { TrainingLevel } from '../../data/trainingCatalog';
import { saveInstantFeedback } from '../../data/userPreferences';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ sessionId: null }) }));
// 空アクション履歴 (UTG open) を再現。file に依らず空を返す。
vi.mock('../../data/training/actionHistory', async (orig) => ({
  ...(await orig<typeof import('../../data/training/actionHistory')>()),
  loadActionHistory: vi.fn().mockResolvedValue([]),
  loadFoldedPositions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../data/training/preflopIntermediatePositional', async (orig) => {
  const actual = await orig<typeof import('../../data/training/preflopIntermediatePositional')>();
  return { ...actual, generatePositionalQuestions: vi.fn(), scorePositionalPoints: vi.fn(() => 2) };
});

import { generatePositionalQuestions } from '../../data/training/preflopIntermediatePositional';
import { navigate } from '../../router/router-core';
import { TrainingPlayPositional } from './TrainingPlayPositional';

const LABELS = { allin: 'オールイン', raise: 'レイズ', call: 'コール', check: 'チェック', fold: 'フォールド' };
const LEVEL: TrainingLevel = {
  key: 'preflop_intermediate_ep',
  label: '中級 EP',
  points: 1,
  questionCount: 20,
  timeLimitSec: 20,
  implemented: true,
};

// 同一シナリオ (UTG open) = 同一ノードファイル。hand だけ変えて2問連続にする。
function utgOpen(hand: PositionalQuestion['hand']): PositionalQuestion {
  return {
    mode: 'ep', scenarioKey: 'ep_open', label: 'UTG オープン', format: 'select',
    myPosition: 'UTG', opener: null, foldedBefore: [], chipExtras: [],
    hand, cards: [{ rank: 'A', suit: 's' }, { rank: 'A', suit: 'h' }],
    strategy: { allin: 0, raise: 100, call: 0, check: 0, fold: 0 },
    sliderAction: 'raise', sliderCorrectPct: 80,
    availableActions: ['allin', 'raise', 'call', 'fold'], actionLabels: LABELS, limpAction: null,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hands: {} }) }) as unknown as Response));
  vi.mocked(generatePositionalQuestions).mockResolvedValue([utgOpen('AA'), utgOpen('KK')]);
  vi.mocked(navigate).mockClear();
  saveInstantFeedback(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayPositional カウントダウン (空履歴×同一file連続)', () => {
  it('2問連続の UTG open で、2問目にもカウントダウンが表示される', async () => {
    const user = userEvent.setup();
    render(<TrainingPlayPositional level={LEVEL} />);

    // 1問目: アニメ完了 (空履歴) でカウントダウンが出る
    expect(await screen.findByText(/残り 20s/)).toBeTruthy();

    // 1問目に回答 → 2問目へ (全2問なのでまだ完了しない)
    await user.click(await screen.findByRole('button', { name: '回答する' }));
    expect(navigate).not.toHaveBeenCalled();

    // 2問目: 同一 file・空履歴でも animReady が true になりカウントダウンが出る
    expect(await screen.findByText(/残り 20s/)).toBeTruthy();
  });
});
