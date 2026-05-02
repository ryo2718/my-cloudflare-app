import { useState } from 'react';
import {
  initialLeftNodePath,
  initialRightNodePath,
  type OpenerPosition,
} from '../../data/scenarios';
import {
  createInitialState,
  type MobileState,
  type MobileTab,
  type Position,
} from '../../types/mobile';
import { ActionButtons } from './ActionButtons';
import { Breadcrumb } from './Breadcrumb';
import { MobileEvalTab } from './MobileEvalTab';
import { PositionPicker } from './PositionPicker';
import { RangeDisplay } from './RangeDisplay';
import { SolutionLabel } from './SolutionLabel';
import { TabSwitcher } from './TabSwitcher';

const SOLUTION_LABEL = 'Cash 100bb 6max NL500 2.5x';

/**
 * モバイル版アプリ — Phase 2C+3+4 統合。
 * GameState (opener/responder/historyPaths) を中央管理し、
 *   - Stage 1 (未選択):       PositionPicker のみ
 *   - Stage 2 (opener):       PositionPicker + Breadcrumb (青) + RangeDisplay
 *   - Stage 3 (responder):    PositionPicker + Breadcrumb (赤) + RangeDisplay + ActionButtons
 *   - Stage 4+ (action click): Breadcrumb + RangeDisplay + ActionButtons (PositionPicker 隠す)
 */
export function MobileApp() {
  const [tab, setTab] = useState<MobileTab>('range');
  const [state, setState] = useState<MobileState>(createInitialState);

  /** PositionPicker タップ — Phase 2A の選択ロジックを GameState 上で再現 */
  const handlePositionTap = (pos: Position) => {
    if (!state.opener) {
      setState({
        opener: pos,
        responder: null,
        historyPaths: [initialLeftNodePath(pos as OpenerPosition)],
      });
    } else if (!state.responder) {
      setState({
        opener: state.opener,
        responder: pos,
        historyPaths: [
          initialLeftNodePath(state.opener as OpenerPosition),
          initialRightNodePath(state.opener as OpenerPosition, pos),
        ],
      });
    } else {
      // 既に2つ選択済み → リセットして新 opener
      setState({
        opener: pos,
        responder: null,
        historyPaths: [initialLeftNodePath(pos as OpenerPosition)],
      });
    }
  };

  /** ActionButton 押下 — historyPaths に新 path を追加 */
  const handleAdvance = (newPath: string) => {
    setState((prev) => ({ ...prev, historyPaths: [...prev.historyPaths, newPath] }));
  };

  /** Breadcrumb Home — 完全リセット */
  const handleReset = () => setState(createInitialState());

  /** Breadcrumb 中間タップ — index までで切り詰め。i=0 (RFI root) なら responder もクリア */
  const handleTruncate = (index: number) => {
    setState((prev) => {
      const newPaths = prev.historyPaths.slice(0, index + 1);
      // i=0 (RFI root に戻る) なら responder クリア (PositionPicker 再表示状態)
      const newResponder = index === 0 ? null : prev.responder;
      return { ...prev, responder: newResponder, historyPaths: newPaths };
    });
  };

  // Stage 4+ では PositionPicker を隠す (操作概念が変わるため)
  const showPicker = state.historyPaths.length <= 2;

  // 現在表示中の path
  const currentPath: string | null =
    state.historyPaths.length > 0 ? state.historyPaths[state.historyPaths.length - 1] : null;

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <TabSwitcher active={tab} onChange={setTab} />

      {tab === 'range' && (
        <>
          <SolutionLabel label={SOLUTION_LABEL} />

          {showPicker && (
            <PositionPicker
              selection={{ opener: state.opener, responder: state.responder }}
              onTap={handlePositionTap}
            />
          )}

          <Breadcrumb
            historyPaths={state.historyPaths}
            opener={state.opener}
            onReset={handleReset}
            onTruncate={handleTruncate}
          />

          <RangeDisplay nodePath={currentPath} opener={state.opener} />

          {state.opener && state.responder && currentPath && state.historyPaths.length >= 2 && (
            <ActionButtons
              currentPath={currentPath}
              opener={state.opener}
              responder={state.responder}
              onAdvance={handleAdvance}
            />
          )}
        </>
      )}

      {tab === 'eval' && <MobileEvalTab />}
    </div>
  );
}
