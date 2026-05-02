import { useState } from 'react';
import type { MobileTab, Position, PositionSelection } from '../../types/mobile';
import { Breadcrumb } from './Breadcrumb';
import { PositionPicker } from './PositionPicker';
import { RangeDisplay } from './RangeDisplay';
import { SolutionLabel } from './SolutionLabel';
import { TabSwitcher } from './TabSwitcher';

const SOLUTION_LABEL = 'Cash 100bb 6max NL500 2.5x';

/**
 * モバイル版アプリ — Phase 2A: タブ + Solution 表示 + ポジション選択。
 * レンジ表示 (RangeDisplay) は Phase 2C で実装、Hand Eval タブは Phase 4。
 */
export function MobileApp() {
  const [tab, setTab] = useState<MobileTab>('range');
  const [selection, setSelection] = useState<PositionSelection>({
    opener: null,
    responder: null,
  });

  /**
   * タップ遷移:
   *  1. opener 未選択 → opener として確定
   *  2. opener 済み・responder 未選択 → responder として確定
   *  3. 2つ選択済み → 新しい opener にリセット (responder クリア)
   * (PositionPicker 側で「同じポジションへの再タップ」「不可ポジション」は除外済)
   */
  const handlePositionTap = (pos: Position) => {
    if (!selection.opener) {
      setSelection({ opener: pos, responder: null });
    } else if (!selection.responder) {
      setSelection({ opener: selection.opener, responder: pos });
    } else {
      setSelection({ opener: pos, responder: null });
    }
  };

  // Breadcrumb 操作
  const handleResetAll = () => setSelection({ opener: null, responder: null });
  const handleResetResponder = () => setSelection({ ...selection, responder: null });

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <TabSwitcher active={tab} onChange={setTab} />

      {tab === 'range' && (
        <>
          <SolutionLabel label={SOLUTION_LABEL} />
          <PositionPicker selection={selection} onTap={handlePositionTap} />
          <Breadcrumb
            selection={selection}
            onReset={handleResetAll}
            onResetResponder={handleResetResponder}
          />
          <RangeDisplay selection={selection} />
        </>
      )}

      {tab === 'eval' && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#6b5a48',
            background: '#fefdf9',
            border: '1px solid #d6cfc1',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        >
          Hand Eval (Phase 4 で実装)
        </div>
      )}
    </div>
  );
}
