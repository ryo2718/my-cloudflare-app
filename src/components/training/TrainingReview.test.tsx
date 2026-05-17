import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainingReview } from './TrainingReview';
import { scenarioLabel } from './scenarioLabel';
import {
  clearRecords,
  saveRecords,
  type ProblemRecord,
} from '../../data/training/recordsStore';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';

const BEGINNER = TRAINING_CATALOG[0].levels[0];

function record(
  id: number,
  isCorrect: boolean,
  opts: {
    scenario?: 'open' | 'vs_open';
    myPosition?: 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
    opener?: 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | null;
    correct?: 'participate' | 'fold';
    userAnswer?: 'participate' | 'fold';
  } = {},
): ProblemRecord {
  const scenario = opts.scenario ?? 'open';
  const myPosition = opts.myPosition ?? (scenario === 'open' ? 'UTG' : 'SB');
  const opener = opts.opener ?? (scenario === 'vs_open' ? 'BTN' : null);
  const correct = opts.correct ?? 'participate';
  const userAnswer = opts.userAnswer ?? (isCorrect ? correct : (correct === 'participate' ? 'fold' : 'participate'));
  return {
    id,
    scenario,
    myPosition,
    opener,
    foldedBefore: [],
    hand: 'QJo',
    cards: [
      { rank: 'Q', suit: 'h' },
      { rank: 'J', suit: 's' },
    ],
    correct,
    userAnswer,
    isCorrect: userAnswer === correct,
  };
}

function render(index: number): string {
  return renderToStaticMarkup(<TrainingReview level={BEGINNER} index={index} />);
}

beforeEach(() => {
  vi.stubGlobal('window', {
    location: { pathname: '/training/preflop-beginner/review/1' },
    history: { pushState: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as Window);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearRecords(BEGINNER.key);
});

describe('scenarioLabel', () => {
  it('open → "UTG オープン判定"', () => {
    const r = record(1, false, { scenario: 'open', myPosition: 'UTG' });
    expect(scenarioLabel(r)).toBe('UTG オープン判定');
  });
  it('vs_open → "vs BTN open"', () => {
    const r = record(1, false, { scenario: 'vs_open', opener: 'BTN' });
    expect(scenarioLabel(r)).toBe('vs BTN open');
  });
});

describe('<TrainingReview />', () => {
  it('記録なし → "見つかりません" メッセージ + 結果画面ボタン', () => {
    const html = render(1);
    expect(html).toContain('見つかりません');
    expect(html).toContain('結果画面へ');
  });

  it('missed が 2 件あれば "振り返り 1 / 2" を表示', () => {
    saveRecords(BEGINNER.key, [
      record(1, false),
      record(2, true),
      record(3, false),
    ]);
    const html = render(1);
    expect(html).toContain('振り返り');
    expect(html).toContain('1 / 2');
  });

  it('選択肢ボタンは disabled (押せない)', () => {
    saveRecords(BEGINNER.key, [record(1, false)]);
    const html = render(1);
    const disabledMatches = html.match(/disabled=""/g) ?? [];
    // 2 つの選択肢 (参加 / 参加しない) が両方 disabled
    expect(disabledMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('正解側に "○" マーク + 不正解側に "×"', () => {
    saveRecords(BEGINNER.key, [record(1, false, { correct: 'participate', userAnswer: 'fold' })]);
    const html = render(1);
    expect(html).toContain('○');
    expect(html).toContain('×');
  });

  it('自分の解答に "あなた" ラベル', () => {
    saveRecords(BEGINNER.key, [record(1, false, { correct: 'participate', userAnswer: 'fold' })]);
    const html = render(1);
    expect(html).toContain('あなた');
  });

  it('正解にも自分の解答にもラベル (両方表示)', () => {
    // 自分が "fold" を選び、正解が "participate" だった: 正解側に "正解" ラベル
    saveRecords(BEGINNER.key, [record(1, false, { correct: 'participate', userAnswer: 'fold' })]);
    const html = render(1);
    expect(html).toContain('正解');
    expect(html).toContain('あなた');
  });

  it('「← 結果に戻る」リンク', () => {
    saveRecords(BEGINNER.key, [record(1, false)]);
    const html = render(1);
    expect(html).toContain('結果に戻る');
    expect(html).toContain('/training/preflop-beginner/result');
  });

  it('1 問目で [前の問題] が disabled', () => {
    saveRecords(BEGINNER.key, [record(1, false), record(2, false)]);
    const html = render(1);
    // 前の問題ボタン周辺 + disabled
    expect(html).toMatch(/disabled[^>]*>[^<]*前の問題/);
  });

  it('最後の問題で [次の問題] が disabled', () => {
    saveRecords(BEGINNER.key, [record(1, false), record(2, false)]);
    const html = render(2);
    expect(html).toMatch(/disabled[^>]*>[^<]*次の問題/);
  });

  it('中間問題 (2/3) では prev/next 両方 enabled', () => {
    saveRecords(BEGINNER.key, [record(1, false), record(2, false), record(3, false)]);
    const html = render(2);
    // disabled な選択肢ボタンは 2 つだが、nav ボタンは enabled
    const disabledMatches = html.match(/disabled=""/g) ?? [];
    expect(disabledMatches.length).toBe(2); // 選択肢のみ
  });
});
