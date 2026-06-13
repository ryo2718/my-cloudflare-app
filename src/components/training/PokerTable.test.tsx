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
    expect(html).toContain('#D8443C'); // raise 赤ベタ塗り
    expect(html).toContain('#2F7BC4'); // fold 青ベタ塗り
    expect(html).toContain('#534AB7'); // allin 紫ベタ塗り
    expect(html).toContain('#3B8A1E'); // call/limp 緑ベタ塗り
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

  it('involvedPositions: 関与外の席を fold ポップアップ無しでも半透明にする', () => {
    // srp CO(自分) vs SB。関与席 = CO,SB。BB/UTG/BTN/HJ は降りた席 → 半透明 (folded 扱い)。
    const html = renderToStaticMarkup(
      <PokerTable
        mePosition="CO"
        involvedPositions={['CO', 'SB']}
        popups={[{ position: 'SB', kind: 'call', label: 'check' }]}
      />,
    );
    expect(html).toContain('opacity:0.35'); // 降りた席が半透明
    expect(html).toContain('BB folded'); // 関与外 → 半透明 (aria-label folded)
    expect(html).toContain('UTG folded');
    expect(html).not.toContain('SB folded'); // 相手 (関与) → はっきり
    expect(html).not.toContain('CO (自分) folded'); // ヒーロー (関与) → はっきり
  });
});
