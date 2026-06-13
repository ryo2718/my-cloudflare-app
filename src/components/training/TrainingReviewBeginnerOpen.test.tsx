import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainingReview } from './TrainingReview';
import {
  saveBeginnerOpenRecords,
  clearBeginnerOpenRecords,
  type BeginnerOpenRecord,
} from '../../data/training/beginnerOpenRecordsStore';
import { TRAINING_CATALOG } from '../../data/trainingCatalog';

const OPEN = TRAINING_CATALOG[0].levels.find((l) => l.key === 'preflop_beginner_open')!;

const RECORDS: BeginnerOpenRecord[] = [
  { id: 1, position: 'UTG', hand: 'A9s', raisePct: 100, answerPct: 60, points: 0 },
  { id: 2, position: 'CO', hand: 'KTo', raisePct: 50, answerPct: 50, points: 0.5 },
  { id: 3, position: 'SB', hand: 'A5s', raisePct: 100, answerPct: null, points: 0 },
];

function render(index: number): string {
  return renderToStaticMarkup(<TrainingReview level={OPEN} index={index} />);
}

beforeEach(() => {
  vi.stubGlobal('window', {
    location: { pathname: '/training/preflop-beginner-open/review/1' },
    history: { pushState: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as Window);
  clearBeginnerOpenRecords(OPEN.key);
});
afterEach(() => {
  clearBeginnerOpenRecords(OPEN.key);
  vi.unstubAllGlobals();
});

describe('TrainingReviewBeginnerOpen (初級オープンの振り返り)', () => {
  it('TrainingReview が preflop_beginner_open をこの画面に委譲する', () => {
    saveBeginnerOpenRecords(OPEN.key, RECORDS);
    const html = render(1);
    expect(html).toContain('← 結果に戻る');
    expect(html).toContain('振り返り');
  });

  it('シナリオ pill (ポジション + オープン) と 正解% / あなた% を表示', () => {
    saveBeginnerOpenRecords(OPEN.key, RECORDS);
    const html = render(1);
    expect(html).toContain('UTG オープン');
    expect(html).toContain('100%'); // 正解(レイズ)
    expect(html).toContain('60%'); // あなた
    expect(html).toContain('1 / 3'); // 進捗
  });

  it('不正解は ✕、正解は ○ を表示', () => {
    saveBeginnerOpenRecords(OPEN.key, RECORDS);
    expect(render(1)).toContain('✕'); // 1問目 points=0
    expect(render(2)).toContain('○'); // 2問目 points>0
  });

  it('スキップ/時間切れ (answerPct=null) は — 表示', () => {
    saveBeginnerOpenRecords(OPEN.key, RECORDS);
    expect(render(3)).toContain('—');
  });

  it('記録なし / 範囲外は「記録が見つかりません」+ 結果画面ボタン', () => {
    // 記録未保存
    expect(render(1)).toContain('記録が見つかりません');
    // 範囲外
    saveBeginnerOpenRecords(OPEN.key, RECORDS);
    expect(render(99)).toContain('記録が見つかりません');
  });
});
