// 13×13 ハンドグリッドの共通基盤。セル配置 (row×col → ハンド名) のみを担い、
// 各セルの描画・色・操作は renderCell に委譲する。
// 座標は utils/hands の RANKS/getHandName を単一の出所として使う。
//   - HandRangeMatrix (トレーニング: セグメント塗り + 凡例 + タップ)
//   - HandMatrix (戦略タブ: グラデ塗り + hover)
// の双方が薄いラッパとしてこれを使う。

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { RANKS, getHandName } from '../utils/hands';

export interface HandGridProps {
  /** (hand, row, col) → 1セルの描画。key は HandGrid 側で付与するため不要。 */
  renderCell: (hand: string, row: number, col: number) => ReactNode;
  /** grid コンテナの追加スタイル (gap 等)。 */
  gridStyle?: CSSProperties;
  /** コンテナの role (例 'grid')。 */
  role?: string;
}

export function HandGrid({ renderCell, gridStyle, role }: HandGridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', ...gridStyle }} role={role}>
      {RANKS.map((_, row) =>
        RANKS.map((__, col) => {
          const hand = getHandName(row, col);
          return <Fragment key={`${row}-${col}`}>{renderCell(hand, row, col)}</Fragment>;
        }),
      )}
    </div>
  );
}
