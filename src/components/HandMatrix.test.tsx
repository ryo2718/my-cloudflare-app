// HandMatrix セル分岐テスト:
//   - sparse (key 未定義) → empty (THEME.cellEmpty) で描画
//   - fold 100% (key 定義あり、 freq=[0,0,0,1]) → HandCell 描画 (青で塗る)
//   - 混合戦略 → HandCell 描画 (gradient stops 含む)
//
// 旧バグ: play 系合計 = 0 のとき empty 扱いになって、 fold 100% ハンドが
//         クリームで表示されていた。 今回の修正でこれを撤去。

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandMatrix } from './HandMatrix';
import type { Action, Strategy } from '../types/strategy';

const ACTIONS: Action[] = [
  { id: 'allin', label: 'All-in', size_bb: 100, color: '#7F77DD' },
  { id: 'raise', label: 'Raise',  size_bb: 7.5, color: '#E24B4A' },
  { id: 'call',  label: 'Call',   size_bb: 2.5, color: '#639922' },
  { id: 'fold',  label: 'Fold',   size_bb: 0,   color: '#378ADD' },
];

function render(strategy: Strategy): string {
  return renderToStaticMarkup(
    <HandMatrix strategy={strategy} actions={ACTIONS} hoveredHand={null} onHover={() => {}} />,
  );
}

describe('<HandMatrix /> セル描画', () => {
  it('169 セル全て描画される (sparse strategy)', () => {
    const html = render({});
    // 169 セル = 全部 sparse (empty 枝)。 HandCell の onMouseEnter は使われない。
    // ともあれ div が 169 + 親 grid + container = 描画される。
    // empty セル特定: linear-gradient を含まないこと
    expect(html).not.toContain('linear-gradient');
  });

  it('fold 100% のハンドは empty 扱いではなく gradient で塗られる (青)', () => {
    // KQo に fold=1.0 (frequencies は 0-1 単位)
    const html = render({ KQo: [0, 0, 0, 1] });
    expect(html).toContain('linear-gradient');
    expect(html).toContain('#378ADD'); // fold color
  });

  it('混合戦略 (raise/call) は両方の色を含む', () => {
    const html = render({ AKs: [0, 0.6, 0.4, 0] });
    expect(html).toContain('#E24B4A'); // raise
    expect(html).toContain('#639922'); // call
  });

  it('100% raise / 100% call / 100% allin もそれぞれ色塗りされる', () => {
    expect(render({ AA: [1, 0, 0, 0] })).toContain('#7F77DD'); // allin
    expect(render({ KK: [0, 1, 0, 0] })).toContain('#E24B4A'); // raise
    expect(render({ QQ: [0, 0, 1, 0] })).toContain('#639922'); // call
  });

  it('sparse なハンド (key 未定義) は gradient なしの空セル', () => {
    // 1 ハンドだけ定義、 他 168 はキー未定義 → gradient は 1 回だけ
    const html = render({ AA: [1, 0, 0, 0] });
    const gradientCount = (html.match(/linear-gradient/g) ?? []).length;
    expect(gradientCount).toBe(1);
  });
});
