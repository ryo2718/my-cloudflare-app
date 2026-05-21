import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandRangeMatrix } from './HandRangeMatrix';
import { ACTION_BG, cellHand, paintCell } from './HandRangeMatrix.helpers';
import type { HandStrategy } from '../../data/training/preflopBeginner';

function s(allin: number, raise: number, call: number, fold: number): HandStrategy {
  return { allin, raise, call, fold };
}

describe('cellHand (row, col) → canonical hand', () => {
  it('対角線はペア', () => {
    expect(cellHand(0, 0)).toBe('AA');
    expect(cellHand(12, 12)).toBe('22');
  });
  it('上三角はスーテッド (列 > 行)', () => {
    expect(cellHand(0, 1)).toBe('AKs');
    expect(cellHand(1, 0)).toBe('AKo');
  });
  it('canonical: 高ランク先頭', () => {
    expect(cellHand(3, 0)).toBe('AJo');
  });
});

describe('paintCell (頻度比率の縦積みセグメント)', () => {
  it('100% fold → 青 100% の 1 セグメント (空白扱いではない)', () => {
    const p = paintCell(s(0, 0, 0, 100));
    expect(p.segments).toEqual([{ color: ACTION_BG.fold, ratio: 100 }]);
  });

  it('100% raise → 赤 100% の 1 セグメント', () => {
    const p = paintCell(s(0, 100, 0, 0));
    expect(p.segments).toEqual([{ color: ACTION_BG.raise, ratio: 100 }]);
  });

  it('100% call → 緑 100% の 1 セグメント', () => {
    const p = paintCell(s(0, 0, 100, 0));
    expect(p.segments).toEqual([{ color: ACTION_BG.call, ratio: 100 }]);
  });

  it('100% allin → 紫 100% の 1 セグメント', () => {
    const p = paintCell(s(100, 0, 0, 0));
    expect(p.segments).toEqual([{ color: ACTION_BG.allin, ratio: 100 }]);
  });

  it('A8s = {0, 0, 58.1, 41.9}: 緑 + 白 の 2 セグメント (浮動小数誤差は許容)', () => {
    const p = paintCell(s(0, 0, 58.1, 41.9));
    expect(p.segments).toHaveLength(2);
    expect(p.segments![0].color).toBe(ACTION_BG.call);
    expect(p.segments![0].ratio).toBeCloseTo(58.1, 1);
    expect(p.segments![1].color).toBe(ACTION_BG.fold);
    expect(p.segments![1].ratio).toBeCloseTo(41.9, 1);
  });

  it('Q4s = {0, 0, 24, 76}: 緑 24% + 白 76%', () => {
    const p = paintCell(s(0, 0, 24, 76));
    expect(p.segments).toEqual([
      { color: ACTION_BG.call, ratio: 24 },
      { color: ACTION_BG.fold, ratio: 76 },
    ]);
  });

  it('60% raise / 40% fold → 赤 60 + 白 40', () => {
    const p = paintCell(s(0, 60, 0, 40));
    expect(p.segments).toEqual([
      { color: ACTION_BG.raise, ratio: 60 },
      { color: ACTION_BG.fold, ratio: 40 },
    ]);
  });

  it('混合 (50% raise / 30% call / 20% fold) → 3 セグメント', () => {
    const p = paintCell(s(0, 50, 30, 20));
    expect(p.segments).toEqual([
      { color: ACTION_BG.raise, ratio: 50 },
      { color: ACTION_BG.call, ratio: 30 },
      { color: ACTION_BG.fold, ratio: 20 },
    ]);
  });

  it('5% raise / 95% fold → 赤 5 + 白 95', () => {
    const p = paintCell(s(0, 5, 0, 95));
    expect(p.segments).toEqual([
      { color: ACTION_BG.raise, ratio: 5 },
      { color: ACTION_BG.fold, ratio: 95 },
    ]);
  });

  it('未定義戦略 → segments null', () => {
    const p = paintCell(undefined);
    expect(p.segments).toBeNull();
  });

  it('全 0% (レンジ外相当) → segments null', () => {
    const p = paintCell(s(0, 0, 0, 0));
    expect(p.segments).toBeNull();
  });

  it('4 アクション全部 (25% ずつ) → 4 セグメント、上から allin→raise→call→fold', () => {
    const p = paintCell(s(25, 25, 25, 25));
    expect(p.segments).toEqual([
      { color: ACTION_BG.allin, ratio: 25 },
      { color: ACTION_BG.raise, ratio: 25 },
      { color: ACTION_BG.call, ratio: 25 },
      { color: ACTION_BG.fold, ratio: 25 },
    ]);
  });
});

describe('<HandRangeMatrix /> 描画', () => {
  it('169 セル全て描画される', () => {
    const html = renderToStaticMarkup(<HandRangeMatrix hands={{}} />);
    const cells = (html.match(/role="gridcell"/g) ?? []).length;
    expect(cells).toBe(169);
  });

  it('凡例にフォールド表記がある', () => {
    const html = renderToStaticMarkup(<HandRangeMatrix hands={{}} />);
    expect(html).toContain('フォールド');
    expect(html).toContain('オールイン');
    expect(html).toContain('レイズ');
    expect(html).toContain('コール');
  });

  it('check のあるノード (limp系) は凡例の緑を「チェック」表記にする (「コール」を出さない)', () => {
    const html = renderToStaticMarkup(
      <HandRangeMatrix hands={{ '72o': { allin: 0, raise: 0, call: 0, check: 100, fold: 0 } }} />,
    );
    expect(html).toContain('チェック');
    expect(html).not.toContain('コール');
  });

  it('check のない通常ノードは凡例の緑が「コール」のまま', () => {
    const html = renderToStaticMarkup(
      <HandRangeMatrix hands={{ AA: s(0, 0, 100, 0) }} />,
    );
    expect(html).toContain('コール');
    expect(html).not.toContain('チェック');
  });

  it('check セルは call と同じ緑 (#639922) で描画される', () => {
    const html = renderToStaticMarkup(
      <HandRangeMatrix hands={{ '72o': { allin: 0, raise: 0, call: 0, check: 100, fold: 0 } }} />,
    );
    expect(html).toContain('#639922');
  });

  it('A8s = {0, 0, 58, 42} で緑 (#639922) と 青 (#378ADD) の両方が描画される', () => {
    const html = renderToStaticMarkup(
      <HandRangeMatrix hands={{ A8s: s(0, 0, 58, 42) }} />,
    );
    expect(html).toContain('#639922');
    expect(html).toContain(ACTION_BG.fold);
  });

  it('highlightHand 指定でそのセルに outline スタイルが付く', () => {
    const html = renderToStaticMarkup(
      <HandRangeMatrix hands={{ AA: s(0, 100, 0, 0) }} highlightHand="AA" />,
    );
    expect(html).toContain('outline:3px solid');
    expect(html).toContain('aria-label="AA"');
    const outlineCount = (html.match(/outline:3px solid/g) ?? []).length;
    expect(outlineCount).toBe(1);
  });

  it('caption が見える', () => {
    const html = renderToStaticMarkup(
      <HandRangeMatrix hands={{}} caption="vs UTG open のレンジ" />,
    );
    expect(html).toContain('vs UTG open のレンジ');
  });
});
