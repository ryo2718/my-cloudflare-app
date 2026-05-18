import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandRangeMatrix } from './HandRangeMatrix';
import { cellHand, paintCell } from './HandRangeMatrix.helpers';
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
    expect(cellHand(1, 0)).toBe('AKo'); // 下三角はオフスート
  });
  it('canonical: 高ランク先頭', () => {
    // (row=3, col=0) は J/A → 下三角 → "AJo"
    expect(cellHand(3, 0)).toBe('AJo');
  });
});

describe('paintCell (頻度比率の縦積み gradient)', () => {
  it('100% fold → background null (play 系 0 → 描画しない)', () => {
    const p = paintCell(s(0, 0, 0, 100));
    expect(p.background).toBeNull();
  });

  it('100% raise → gradient に赤 100%', () => {
    const p = paintCell(s(0, 100, 0, 0));
    expect(p.background).toContain('#E24B4A 0.00%');
    expect(p.background).toContain('#E24B4A 100.00%');
  });

  it('100% call → gradient に緑のみ', () => {
    const p = paintCell(s(0, 0, 100, 0));
    expect(p.background).toContain('#639922');
    expect(p.background).not.toContain('#E24B4A');
    expect(p.background).not.toContain('#993C9D');
  });

  it('100% allin → gradient に紫のみ', () => {
    const p = paintCell(s(100, 0, 0, 0));
    expect(p.background).toContain('#993C9D');
  });

  it('Q4s = {0, 0, 24, 76}: 緑 24% + fold(#ffffff) 76% の縦積み', () => {
    const p = paintCell(s(0, 0, 24, 76));
    // #ffffff 0% → 76% (fold 下), 緑 76% → 100% (call 上)
    expect(p.background).toContain('#ffffff 0.00%');
    expect(p.background).toContain('#ffffff 76.00%');
    expect(p.background).toContain('#639922 76.00%');
    expect(p.background).toContain('#639922 100.00%');
  });

  it('60% raise / 40% fold → 赤 60% + fold 40% (積上)', () => {
    const p = paintCell(s(0, 60, 0, 40));
    expect(p.background).toContain('#ffffff 0.00%');
    expect(p.background).toContain('#ffffff 40.00%');
    expect(p.background).toContain('#E24B4A 40.00%');
    expect(p.background).toContain('#E24B4A 100.00%');
  });

  it('混合 (50% raise / 30% call / 20% fold) → 3 色積み', () => {
    const p = paintCell(s(0, 50, 30, 20));
    // 下から: fold #ffffff 0-20%, call 緑 20-50%, raise 赤 50-100%
    expect(p.background).toContain('#ffffff 0.00%');
    expect(p.background).toContain('#639922 20.00%');
    expect(p.background).toContain('#E24B4A 50.00%');
  });

  it('5% raise / 95% fold (微小 play) → 描画される (play_total >= MIN_FREQ)', () => {
    const p = paintCell(s(0, 5, 0, 95));
    expect(p.background).toContain('#E24B4A');
    expect(p.background).toContain('#ffffff');
  });

  it('未定義戦略 → background null', () => {
    const p = paintCell(undefined);
    expect(p.background).toBeNull();
  });

  it('全 0% (レンジ外相当) → background null', () => {
    const p = paintCell(s(0, 0, 0, 0));
    expect(p.background).toBeNull();
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

  it('highlightHand 指定でそのセルに outline スタイルが付く', () => {
    const html = renderToStaticMarkup(
      <HandRangeMatrix
        hands={{ AA: s(0, 100, 0, 0) }}
        highlightHand="AA"
      />,
    );
    // outline:3px と aria-label="AA" の両方が含まれること (attribute 順序は気にしない)
    expect(html).toContain('outline:3px solid');
    expect(html).toContain('aria-label="AA"');
    // 1 セルだけ outline を持つ
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
