// 6max ポーカーテーブル俯瞰図。
//
// 配置ルール:
//   - 自分 (mePosition) は常に画面下中央
//   - 他の 5 player は時計回り (UTG→HJ→CO→BTN→SB→BB) に bottom_left → top_left → top_center
//     → top_right → bottom_right の順で配置
//
// 入力:
//   - mePosition: 自分のポジション
//   - opener: 既に open した player (チップ表示 + アクション表示用)。null = まだ open なし
//   - foldedSet: opener より前にフォールド済 player の集合 (透明表示用)
//   - dealerSeat: D マーカー位置 (= BTN)
//   - bbAmount/sbAmount: 通常 1 / 0.5 を強調表示
//
// Note: 同一テーブルは Confirm/Play/Result でも使い回せるよう純粋プレゼンテーション。

import type { CSSProperties } from 'react';
import type { Position } from '../../types/strategy';

// 順序: UTG → HJ → CO → BTN → SB → BB (preflop action order)
const PREFLOP_ORDER: ReadonlyArray<Position> = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

type Slot = 'bottom_center' | 'bottom_left' | 'top_left' | 'top_center' | 'top_right' | 'bottom_right';
const SLOTS_CW: ReadonlyArray<Slot> = [
  'bottom_center',
  'bottom_left',
  'top_left',
  'top_center',
  'top_right',
  'bottom_right',
];

/** チップの種別。'allin' = 5bet ジャム等 (黒背景・白文字)。 */
export type ChipVariant = 'allin';

export interface PlayerChip {
  /** ベット額 (chips on table)、bb 単位 (0.5 / 1 / 2.5 等)。 */
  amount: number;
  /** 特殊表示 (5bet ジャム = 黒)。 */
  variant?: ChipVariant;
}

export interface ChipExtra {
  position: Position;
  amount: number;
  /** 5bet ジャム等を黒チップで表示する場合に 'allin'。 */
  variant?: ChipVariant;
}

export interface PokerTableProps {
  /** 自分のポジション。下中央に配置される。 */
  mePosition: Position;
  /** 既にプリフロップ open した player (raise 額 = openSize で chip 表示)。null なら誰も open してない。 */
  opener?: Position | null;
  /** open サイズ (bb)。デフォルト 2.5。 */
  openSize?: number;
  /** open より前にフォールド済の player (UI で透明化)。 */
  foldedSet?: ReadonlyArray<Position>;
  /**
   * 複数アクター対応: 指定ポジションに固定額のチップを表示。
   * chipExtras に存在するポジションは opener や SB/BB ブラインドの値より優先される。
   * (vs_3bet で opener=2.5 + 3bettor=12、vs_4bet で opener=30 + 3bettor=12 等)
   */
  chipExtras?: ReadonlyArray<ChipExtra>;
}

/** mePosition を「下中央」とした時の slot → position マッピング。 */
function arrangePositions(me: Position): Record<Slot, Position> {
  const idx = PREFLOP_ORDER.indexOf(me);
  const out: Partial<Record<Slot, Position>> = {};
  for (let k = 0; k < 6; k++) {
    out[SLOTS_CW[k]] = PREFLOP_ORDER[(idx + k) % 6];
  }
  return out as Record<Slot, Position>;
}

const SB_AMOUNT = 0.5;
const BB_AMOUNT = 1;

export function PokerTable({
  mePosition,
  opener = null,
  openSize = 2.5,
  foldedSet = [],
  chipExtras = [],
}: PokerTableProps) {
  const slots = arrangePositions(mePosition);
  const foldedLookup = new Set(foldedSet);

  const chipFor = (pos: Position): PlayerChip | null => {
    // chipExtras 優先 (vs_3bet / vs_4bet で複数アクターのチップを表示するため)
    const extra = chipExtras.find((e) => e.position === pos);
    if (extra) return { amount: extra.amount, variant: extra.variant };
    if (pos === opener) return { amount: openSize };
    if (pos === 'SB' && opener !== 'SB') return { amount: SB_AMOUNT };
    if (pos === 'BB' && opener !== 'BB') return { amount: BB_AMOUNT };
    return null;
  };

  return (
    <div style={containerStyle}>
      <div style={tableStyle} aria-label="ポーカーテーブル">
        {SLOTS_CW.map((slot) => {
          const pos = slots[slot];
          const isMe = pos === mePosition;
          const isFolded = foldedLookup.has(pos);
          return (
            <PlayerSeat
              key={slot}
              slot={slot}
              position={pos}
              isMe={isMe}
              isFolded={isFolded}
              chip={chipFor(pos)}
              isDealer={pos === 'BTN'}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerSeat
// ---------------------------------------------------------------------------

function PlayerSeat({
  slot,
  position,
  isMe,
  isFolded,
  chip,
  isDealer,
}: {
  slot: Slot;
  position: Position;
  isMe: boolean;
  isFolded: boolean;
  chip: PlayerChip | null;
  isDealer: boolean;
}) {
  const seatStyle: CSSProperties = {
    ...seatBaseStyle,
    ...SLOT_POSITIONS[slot],
    ...(isMe ? meSeatStyle : {}),
    opacity: isFolded ? 0.3 : 1,
  };

  return (
    <>
      <div style={seatStyle} aria-label={`${position}${isMe ? ' (自分)' : ''}${isFolded ? ' folded' : ''}`}>
        {position}
      </div>
      {isDealer && (
        <div
          style={{ ...dealerStyle, ...DEALER_OFFSETS[slot], opacity: isFolded ? 0.5 : 1 }}
          aria-hidden
        >
          D
        </div>
      )}
      {chip && (
        <div
          style={{ ...chipStyle(chip), ...CHIP_OFFSETS[slot] }}
          aria-label={`${position} ${chip.amount}bb${chip.variant === 'allin' ? ' (5bet)' : ''}`}
        >
          {formatChip(chip.amount)}
        </div>
      )}
    </>
  );
}

function chipStyle(chip: PlayerChip): CSSProperties {
  const { bg, fg, border } = chipColor(chip.amount, chip.variant);
  return {
    ...chipBaseStyle,
    background: bg,
    color: fg,
    borderColor: border,
    fontSize: formatChip(chip.amount).length >= 3 ? '10px' : '13px',
  };
}

function chipColor(amount: number, variant?: ChipVariant): { bg: string; fg: string; border: string } {
  if (variant === 'allin') return { bg: '#2C2C2A', fg: '#ffffff', border: '#000000' }; // 黒 = 5bet ジャム
  if (amount < 3) return { bg: '#ffffff', fg: '#000000', border: '#888780' }; // white = small
  if (amount < 20) return { bg: '#E24B4A', fg: '#ffffff', border: '#F7C1C1' }; // red = medium
  return { bg: '#3B6D11', fg: '#ffffff', border: '#C0DD97' }; // green = large
}

function formatChip(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(/\.0$/, '');
}

// ---------------------------------------------------------------------------
// Styles & layout offsets
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
};

const tableStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 360,
  aspectRatio: '4 / 3',
  background: '#3B6D11',
  borderRadius: '50%',
  border: '4px solid #5F5E5A',
  boxSizing: 'border-box',
};

const seatBaseStyle: CSSProperties = {
  position: 'absolute',
  width: 42,
  height: 42,
  borderRadius: '50%',
  background: '#FFFFFF',
  border: '1.5px solid #D3D1C7',
  color: '#5F5E5A',
  fontSize: 13,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
};

const meSeatStyle: CSSProperties = {
  background: '#993C1D',
  color: '#FFFFFF',
  border: '2px solid #993C1D',
};

const dealerStyle: CSSProperties = {
  position: 'absolute',
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#FAC775',
  border: '2px solid #BA7517',
  color: '#633806',
  fontSize: 12,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const chipBaseStyle: CSSProperties = {
  position: 'absolute',
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '2px dashed',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 500,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  lineHeight: 1,
};

// 各 slot の絶対位置 (テーブル内座標、percentage)
const SLOT_POSITIONS: Record<Slot, CSSProperties> = {
  bottom_center: { bottom: '2%',   left: '50%',  transform: 'translateX(-50%)' },
  bottom_left:   { bottom: '32%',  left: '6%' },
  top_left:      { top: '20%',     left: '6%' },
  top_center:    { top: '2%',      left: '50%',  transform: 'translateX(-50%)' },
  top_right:     { top: '20%',     right: '6%' },
  bottom_right:  { bottom: '32%',  right: '6%' },
};

// チップは座席の「テーブル中央寄り」に置く
const CHIP_OFFSETS: Record<Slot, CSSProperties> = {
  bottom_center: { bottom: '20%',  left: '50%',  transform: 'translateX(-50%)' },
  bottom_left:   { bottom: '36%',  left: '24%' },
  top_left:      { top: '34%',     left: '24%' },
  top_center:    { top: '20%',     left: '50%',  transform: 'translateX(-50%)' },
  top_right:     { top: '34%',     right: '24%' },
  bottom_right:  { bottom: '36%',  right: '24%' },
};

// Dealer button は BTN 座席の内側 (テーブル中央寄り) に小さく
const DEALER_OFFSETS: Record<Slot, CSSProperties> = {
  bottom_center: { bottom: '8%',   left: '64%' },
  bottom_left:   { bottom: '38%',  left: '34%' },
  top_left:      { top: '26%',     left: '34%' },
  top_center:    { top: '8%',      left: '60%' },
  top_right:     { top: '26%',     right: '34%' },
  bottom_right:  { bottom: '38%',  right: '34%' },
};
