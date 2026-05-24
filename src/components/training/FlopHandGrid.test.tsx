// @vitest-environment jsdom
// フロップ中級CBグリッド: 6色積み上げセル + タップで混合戦略の内訳バー。

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, userEvent } from '../../test/ui';
import { FlopHandGrid } from './FlopHandGrid';
import type { FlopCbStrat } from '../../data/training/flopIntermediateCb';

const hands: Record<string, FlopCbStrat> = {
  QQ: { check: 0.6, '33': 0.3, '50': 0.1 },
  AKs: { check: 0.1, '75': 0.5, '125': 0.4 },
};

describe('FlopHandGrid', () => {
  it('セルが6色ランプで積み上げ表示される (各色がHTMLに出る)', () => {
    const html = renderToStaticMarkup(<FlopHandGrid hands={hands} highlightHand="QQ" />);
    expect(html).toContain('#3B8A1E'); // check 緑
    expect(html).toContain('#EF9F27'); // 33 アンバー
    expect(html).toContain('#D85A30'); // 50 コーラル
    expect(html).toContain('#E24B4A'); // 75 赤
    expect(html).toContain('#A32D2D'); // 125 濃赤
  });

  it('セルをタップすると混合戦略の内訳が表示される', async () => {
    const user = userEvent.setup();
    render(<FlopHandGrid hands={hands} highlightHand="QQ" />);
    expect(screen.queryByText('QQ の混合戦略')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'QQ' }));
    expect(screen.getByText('QQ の混合戦略')).toBeTruthy();
  });

  it('レンジ外のハンド (strat無し) はタップ不可', () => {
    render(<FlopHandGrid hands={hands} />);
    expect(screen.queryByRole('button', { name: '72o' })).toBeNull();
  });
});
