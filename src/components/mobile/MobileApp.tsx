import { useState } from 'react';
import {
  initialLeftNodePath,
  initialRightNodePath,
  type OpenerPosition,
} from '../../data/scenarios';
import {
  canSelectAsResponder,
  createInitialState,
  type MobileState,
  type MobileTab,
  type OpenerAction,
  type Position,
} from '../../types/mobile';
// Flop 関連 props のみ strategy.ts 側の Position 型を別名で import
// (mobile.ts の Position は MP を含まないため、Flop データの全 6max ポジション + α と互換性を取る)
import type { Position as StrategyPosition } from '../../types/strategy';
import { ActionButtons } from './ActionButtons';
import { Breadcrumb } from './Breadcrumb';
import { DualPositionPicker } from './DualPositionPicker';
import { MobileEvalTab } from './MobileEvalTab';
import { MobileFlopView } from './MobileFlopView';
import { RangeDisplay } from './RangeDisplay';
import { ResetButton } from './ResetButton';
import { SolutionLabel } from './SolutionLabel';
import { TabSwitcher } from './TabSwitcher';

const SOLUTION_LABEL = 'cash 100bb 6max NL500 2.5x';

interface MobileAppProps {
  /**
   * Flop タブの state (Phase R2 で UI 主導 model に変更)。
   * App.tsx に lift 済の値をそのまま渡す → MobileFlopView へ伝搬。
   * PC ↔ Mobile 切替時も state 維持。
   */
  flopPositions: ReadonlyArray<StrategyPosition>;
  flopBucket: import('../../data/flopVariants').PreflopBucket | null;
  flopChain: string[];
  flopSelectedBoardName: string | null;
  onFlopPositionsChange: (positions: StrategyPosition[]) => void;
  onFlopBucketChange: (bucket: import('../../data/flopVariants').PreflopBucket | null) => void;
  onFlopChainChange: (chain: string[]) => void;
  onSelectFlopBoard: (name: string | null) => void;
  /**
   * Phase 2b': /strategy 統合時に「プリフロップ (range タブ) のみ」を描画するモード。
   * 上位 (StrategyPage) が TopTabs を持つため、内部 TabSwitcher と flop/eval タブを隠す。
   * 既定 (undefined/false) は従来通り 3 タブ (range/eval/flop) を表示。
   */
  preflopOnly?: boolean;
}

/**
 * モバイル版アプリ — 大幅 UI 改修版。
 *
 * 新レイアウト (上から):
 *   1. SolutionLabel (タップ無効)
 *   2. DualPositionPicker (OPENER + RESPONDER の 2 セット)
 *   3. Breadcrumb (アクター色)
 *   4. ActionButtons (★レンジの上に移動)
 *   5. RangeDisplay (matrix + aggregate)
 *   6. ResetButton (画面下)
 *
 * Stage 4+ (action 1回以上押下) では DualPositionPicker の選択済み以外がグレーアウト。
 * 直前のアクションは actor のボタン上に吹き出し表示。
 */
export function MobileApp({
  flopPositions,
  flopBucket,
  flopChain,
  flopSelectedBoardName,
  onFlopPositionsChange,
  onFlopBucketChange,
  onFlopChainChange,
  onSelectFlopBoard,
  preflopOnly = false,
}: MobileAppProps) {
  const [tab, setTab] = useState<MobileTab>('range');
  const effectiveTab: MobileTab = preflopOnly ? 'range' : tab;
  const [state, setState] = useState<MobileState>(createInitialState);

  /** OPENER パネルでタップ — 別 opener へ切替 (responder/history/openerAction を破棄) */
  const handleOpenerTap = (pos: Position) => {
    if (pos === 'BB') return; // 安全策
    if (state.opener === pos) return; // 同じ → no-op
    setState({
      opener: pos,
      openerAction: 'open', // 切替時は常に open に戻す (limp は SB だけの選択肢)
      responder: null,
      historyPaths: [initialLeftNodePath(pos as OpenerPosition)],
    });
  };

  /** SB の open ⇄ limp 切替 (SB 選択時だけ意味を持つ)。switch で responder/history をリセット。 */
  const handleOpenerActionTap = (action: OpenerAction) => {
    if (state.opener !== 'SB') return; // SB 以外では no-op
    if (state.openerAction === action) return;
    setState({
      opener: 'SB',
      openerAction: action,
      responder: null,
      historyPaths: [initialLeftNodePath('SB')],
    });
  };

  /** RESPONDER パネルでタップ — opener 維持、responder 切替で history を 2 段にリセット */
  const handleResponderTap = (pos: Position) => {
    // ガード: opener より前の席 (例: opener=HJ, pos=UTG) は存在しないノード参照になるため拒否。
    if (!canSelectAsResponder(state.opener, pos)) return;
    if (state.responder === pos) return;
    setState({
      opener: state.opener,
      openerAction: state.openerAction,
      responder: pos,
      historyPaths: [
        initialLeftNodePath(state.opener as OpenerPosition),
        initialRightNodePath(state.opener as OpenerPosition, pos, state.openerAction),
      ],
    });
  };

  /** ActionButton — historyPaths に新 path を追加 */
  const handleAdvance = (newPath: string) => {
    setState((prev) => ({ ...prev, historyPaths: [...prev.historyPaths, newPath] }));
  };

  /** Breadcrumb HOME / 画面下 ResetButton — 完全リセット */
  const handleReset = () => setState(createInitialState());

  /** Breadcrumb 過去 segment — historyPaths を newLength に切り詰め */
  const handleTruncate = (newLength: number) => {
    setState((prev) => {
      const newPaths = prev.historyPaths.slice(0, newLength);
      const newResponder = newLength <= 1 ? null : prev.responder;
      return { ...prev, responder: newResponder, historyPaths: newPaths };
    });
  };

  // 現在表示中の path
  const currentPath: string | null =
    state.historyPaths.length > 0 ? state.historyPaths[state.historyPaths.length - 1] : null;

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {!preflopOnly && <TabSwitcher active={tab} onChange={setTab} />}

      {effectiveTab === 'range' && (
        <>
          <SolutionLabel label={SOLUTION_LABEL} />

          <DualPositionPicker
            state={state}
            onTapOpener={handleOpenerTap}
            onTapOpenerAction={handleOpenerActionTap}
            onTapResponder={handleResponderTap}
          />

          <Breadcrumb
            historyPaths={state.historyPaths}
            opener={state.opener}
            onReset={handleReset}
            onTruncate={handleTruncate}
          />

          {/* ★ ActionButtons は RangeDisplay の「上」に配置 */}
          {state.opener && state.responder && currentPath && state.historyPaths.length >= 2 && (
            <ActionButtons
              currentPath={currentPath}
              opener={state.opener}
              responder={state.responder}
              onAdvance={handleAdvance}
            />
          )}

          <RangeDisplay nodePath={currentPath} opener={state.opener} />

          <ResetButton onReset={handleReset} />
        </>
      )}

      {!preflopOnly && effectiveTab === 'eval' && <MobileEvalTab />}

      {!preflopOnly && effectiveTab === 'flop' && (
        <MobileFlopView
          positions={flopPositions}
          bucket={flopBucket}
          chain={flopChain}
          selectedBoardName={flopSelectedBoardName}
          onPositionsChange={onFlopPositionsChange}
          onBucketChange={onFlopBucketChange}
          onChainChange={onFlopChainChange}
          onSelectBoard={onSelectFlopBoard}
        />
      )}
    </div>
  );
}
