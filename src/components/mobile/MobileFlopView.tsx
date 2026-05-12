// Mobile 用 Flop 戦略ビュー (Phase 7)。
//
// Q4-C 方針: データ層は PC FlopStrategyView と完全共有、UI ラッパーのみ Mobile 用。
// FlopStrategyView は Phase 6 で controlled props 化されており、内部 sub-component
// (FlopVariantSelector / FlopBreadcrumb / FlopBoardSummary / FlopActionTotalsCard /
//  FlopNextActionButtons / FlopBoardInput / FlopBoardList) はすべて flex-wrap /
// max-width で responsive に振る舞うため、本ラッパーは container padding のみ調整。
//
// 将来 Mobile 専用 UI 改修が必要になった場合 (例: scroll-friendly layout、bottom
// sheet, swipe gestures など)、本ファイルを起点に bespoke sub-components へ
// 置換していく想定。

import { type CSSProperties } from 'react';
import {
  FlopStrategyView,
  type FlopStrategyViewProps,
} from '../FlopStrategyView';

export type MobileFlopViewProps = FlopStrategyViewProps;

export function MobileFlopView(props: MobileFlopViewProps) {
  return (
    <div style={containerStyle}>
      <FlopStrategyView {...props} />
    </div>
  );
}

const containerStyle: CSSProperties = {
  // Mobile の TabSwitcher 下部に薄い間隔を入れ、横方向は呼出側 padding を尊重
  padding: '0.25rem 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
