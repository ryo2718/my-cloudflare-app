import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PokerTable } from './PokerTable';

describe('PokerTable アクションポップアップ', () => {
  it('各座席のアクションをテキストで表示 (チップではない)', () => {
    const html = renderToStaticMarkup(
      <PokerTable
        mePosition="UTG"
        popups={[
          { position: 'HJ', kind: 'raise', label: 'raise 2.5' },
          { position: 'CO', kind: 'fold', label: 'fold' },
          { position: 'BTN', kind: 'allin', label: 'allin' },
          { position: 'SB', kind: 'limp', label: 'limp' },
        ]}
      />,
    );
    expect(html).toContain('raise 2.5');
    expect(html).toContain('fold');
    expect(html).toContain('allin');
    expect(html).toContain('limp');
  });

  it('色分け: raise=赤 / fold=青 / allin=紫 / limp=緑', () => {
    const html = renderToStaticMarkup(
      <PokerTable
        mePosition="UTG"
        popups={[
          { position: 'HJ', kind: 'raise', label: 'raise 2.5' },
          { position: 'CO', kind: 'fold', label: 'fold' },
          { position: 'BTN', kind: 'allin', label: 'allin' },
          { position: 'SB', kind: 'limp', label: 'limp' },
        ]}
      />,
    );
    expect(html).toContain('#FAECE7'); // raise 淡赤背景
    expect(html).toContain('#E6F1FB'); // fold 淡青背景
    expect(html).toContain('#ECEAF7'); // allin 淡紫背景
    expect(html).toContain('#E8F0DA'); // call/limp 淡緑背景
  });

  it('チップ (点線円) は描画されない', () => {
    const html = renderToStaticMarkup(
      <PokerTable mePosition="UTG" popups={[{ position: 'HJ', kind: 'fold', label: 'fold' }]} />,
    );
    expect(html).not.toContain('2px dashed'); // 旧チップ枠スタイル
  });

  it('popups 未指定でも座席は描画される', () => {
    const html = renderToStaticMarkup(<PokerTable mePosition="CO" />);
    expect(html).toContain('CO');
    expect(html).toContain('UTG');
  });
});
