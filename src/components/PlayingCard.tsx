// 共通プレイングカード。スーツ色を背景全面、ランクを白文字で中央表示。
// スタイル定義・純関数 helper は PlayingCard.helpers.ts に分離 (react-refresh 規約)。

import type { Rank, Suit } from '../types/card';
import {
  defaultPlayingCardAriaLabel,
  getPlayingCardStyle,
  type CardSize,
} from './PlayingCard.helpers';

export interface PlayingCardProps {
  rank: Rank;
  suit: Suit;
  /** デフォルト 'md'。 */
  size?: CardSize;
  /** true で半透明 + click 無効。 */
  disabled?: boolean;
  /** true で黄色アウトライン (選択中フィードバック)。 */
  selected?: boolean;
  /** あれば <button>、無ければ <span role="img"> を render。 */
  onClick?: () => void;
  /** a11y ラベル。未指定なら「A of Spades」風自動生成。 */
  ariaLabel?: string;
}

export function PlayingCard({
  rank,
  suit,
  size = 'md',
  disabled = false,
  selected = false,
  onClick,
  ariaLabel,
}: PlayingCardProps) {
  const clickable = onClick !== undefined;
  const style = getPlayingCardStyle({ suit, size, disabled, selected, clickable });
  const label = ariaLabel ?? defaultPlayingCardAriaLabel(rank, suit);

  if (clickable) {
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={selected || undefined}
        style={style}
      >
        {rank}
      </button>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      aria-disabled={disabled || undefined}
      style={style}
    >
      {rank}
    </span>
  );
}
