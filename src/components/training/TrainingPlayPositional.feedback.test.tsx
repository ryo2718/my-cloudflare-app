// @vitest-environment jsdom
// フェーズ2: 即時フィードバックの振る舞い (中級ポジショナル画面)。
//   - トグルON: 回答 → 判定/pt/レンジ/頻度バー/「次のハンドへ」表示、slider は「正解%/あなた%」
//   - 表示中タイマー停止 → 「次のハンドへ」で次問へ
//   - トグルOFF: 回答後すぐ次問 (フィードバックなし)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '../../test/ui';
import type { PositionalQuestion } from '../../data/training/preflopIntermediatePositional';
import type { TrainingLevel } from '../../data/trainingCatalog';
import { saveInstantFeedback } from '../../data/userPreferences';

vi.mock('../../router/router-core', () => ({ navigate: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ sessionId: null }) }));
vi.mock('../../data/training/actionHistory', async (orig) => ({
  ...(await orig<typeof import('../../data/training/actionHistory')>()),
  loadActionHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../data/training/preflopIntermediatePositional', async (orig) => {
  const actual = await orig<typeof import('../../data/training/preflopIntermediatePositional')>();
  return { ...actual, generatePositionalQuestions: vi.fn(), scorePositionalPoints: vi.fn(() => 2) };
});

import { generatePositionalQuestions } from '../../data/training/preflopIntermediatePositional';
import { TrainingPlayPositional } from './TrainingPlayPositional';

const LABELS = { allin: 'オールイン', raise: 'レイズ', call: 'コール', check: 'チェック', fold: 'フォールド' };
const HANDS = { AA: { allin: 0, raise: 100, call: 0, check: 0, fold: 0 } };

const LEVEL: TrainingLevel = {
  key: 'preflop_intermediate_ep',
  label: '中級 EP',
  points: 1,
  questionCount: 20,
  timeLimitSec: 'none',
  implemented: true,
};

function makeQ(format: 'slider' | 'select'): PositionalQuestion {
  return {
    mode: 'ep',
    scenarioKey: 'ep_open',
    label: 'UTG オープン',
    format,
    myPosition: 'UTG',
    opener: null,
    foldedBefore: [],
    chipExtras: [],
    hand: 'AA',
    cards: [
      { rank: 'A', suit: 's' },
      { rank: 'A', suit: 'h' },
    ],
    strategy: { allin: 0, raise: 100, call: 0, check: 0, fold: 0 },
    sliderAction: 'raise',
    sliderCorrectPct: 80,
    availableActions: ['allin', 'raise', 'call', 'fold'],
    actionLabels: LABELS,
    limpAction: null,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hands: HANDS }) }) as unknown as Response));
  vi.mocked(generatePositionalQuestions).mockResolvedValue([makeQ('slider'), makeQ('select')]);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPlayPositional 即時フィードバック (UI)', () => {
  it('トグルON: スライダー回答で判定/pt/頻度/「次のハンドへ」/「正解%/あなた%」が出る', async () => {
    saveInstantFeedback(true);
    const user = userEvent.setup();
    render(<TrainingPlayPositional level={LEVEL} />);

    // 出題 → アニメ完了でスライダーUIが出る
    const submit = await screen.findByRole('button', { name: '回答する' });
    await user.click(submit);

    // フィードバック: 判定◎ (mock pts=2) + +2pt + 次のハンドへ
    expect(await screen.findByText('次のハンドへ')).toBeTruthy();
    expect(screen.getByText('◎')).toBeTruthy();
    expect(screen.getByText('+2pt')).toBeTruthy();
    // slider の「正解% / あなた%」(default 50%, 正解 80%)
    expect(screen.getByText('正解 80% / あなた 50%')).toBeTruthy();
    // 頻度バーの行 (レンジ JSON 由来)。'レイズ' は凡例にもあるので複数可。
    expect(screen.getAllByText('レイズ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });

  it('「次のハンドへ」で次問に進む (フィードバックが消え回答UIが戻る)', async () => {
    saveInstantFeedback(true);
    const user = userEvent.setup();
    render(<TrainingPlayPositional level={LEVEL} />);

    await user.click(await screen.findByRole('button', { name: '回答する' }));
    await user.click(await screen.findByText('次のハンドへ'));

    // 次の問題 (select) の回答UIが出て、フィードバックは消えている
    expect(await screen.findByRole('button', { name: '回答する' })).toBeTruthy();
    expect(screen.queryByText('次のハンドへ')).toBeNull();
  });

  it('表示中はタイマーが停止する (回答前は残り表示あり→回答後は消える)', async () => {
    saveInstantFeedback(true);
    const user = userEvent.setup();
    const { container } = render(<TrainingPlayPositional level={LEVEL} />);

    const submit = await screen.findByRole('button', { name: '回答する' });
    // アニメ完了 (animReady) 後にタイマーが出る
    await waitFor(() => expect(container.querySelector('[aria-live="polite"]')).not.toBeNull());
    await user.click(submit);
    await screen.findByText('次のハンドへ');
    expect(container.querySelector('[aria-live="polite"]')).toBeNull(); // タイマー停止
  });

  it('トグルOFF: 回答後フィードバックを出さず次問へ', async () => {
    saveInstantFeedback(false);
    const user = userEvent.setup();
    render(<TrainingPlayPositional level={LEVEL} />);

    await user.click(await screen.findByRole('button', { name: '回答する' }));
    // フィードバックは出ない。次問 (select) の回答UIへ。
    expect(await screen.findByRole('button', { name: '回答する' })).toBeTruthy();
    expect(screen.queryByText('次のハンドへ')).toBeNull();
    expect(screen.queryByText('◎')).toBeNull();
  });
});
