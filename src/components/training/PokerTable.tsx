// 6max ポーカーテーブル俯瞰図 (プレゼンテーション専用)。
//
// チップは廃止。各ポジションのアクションを「テキストポップアップ」(fold / raise 2.5 / call /
// limp / allin) で表示する。表示するアクションは popups (= 各座席の最新アクション) で渡す。
// アニメーション (0.2 秒間隔の順次表示) や action_history の読み込みは ActionTable 側で行う。
//
// 配置: 自分 (mePosition) は下中央、他 5 名を時計回りに配置。

import type { CSSProperties } from 'react';
import type { Position } from '../../types/strategy';
import { ACTION_COLORS, type SeatPopup } from '../../data/training/actionHistory';

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

export interface PokerTableProps {
  /** 自分のポジション。下中央に配置される。 */
  mePosition: Position;
  /** 各座席のアクションポップアップ (= その座席の最新アクション)。未指定なら何も表示しない。 */
  popups?: ReadonlyArray<SeatPopup>;
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

export function PokerTable({ mePosition, popups = [] }: PokerTableProps) {
  const slots = arrangePositions(mePosition);
  const popupByPos = new Map<Position, SeatPopup>();
  for (const p of popups) popupByPos.set(p.position, p);

  return (
    <div style={containerStyle}>
      <div style={tableStyle} aria-label="ポーカーテーブル">
        {SLOTS_CW.map((slot) => {
          const pos = slots[slot];
          const isMe = pos === mePosition;
          const popup = popupByPos.get(pos) ?? null;
          const isFolded = popup?.kind === 'fold';
          return (
            <PlayerSeat
              key={slot}
              slot={slot}
              position={pos}
              isMe={isMe}
              isFolded={isFolded}
              popup={popup}
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
  popup,
  isDealer,
}: {
  slot: Slot;
  position: Position;
  isMe: boolean;
  isFolded: boolean;
  popup: SeatPopup | null;
  isDealer: boolean;
}) {
  const seatStyle: CSSProperties = {
    ...seatBaseStyle,
    ...SLOT_POSITIONS[slot],
    ...(isMe ? meSeatStyle : {}),
    opacity: isFolded ? 0.35 : 1,
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
      {popup && (
        <div
          style={{ ...popupStyle(popup.kind), ...POPUP_OFFSETS[slot] }}
          aria-label={`${position} ${popup.label}`}
        >
          {popup.label}
        </div>
      )}
    </>
  );
}

function popupStyle(kind: SeatPopup['kind']): CSSProperties {
  const c = ACTION_COLORS[kind];
  return {
    ...popupBaseStyle,
    color: c.fg,
    background: c.bg,
    borderColor: c.border,
  };
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

const popupBaseStyle: CSSProperties = {
  position: 'absolute',
  padding: '2px 7px',
  borderRadius: '999px',
  border: '1.5px solid',
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  lineHeight: 1.3,
  transform: 'translate(-50%, -50%)',
};

// 各 slot の絶対位置 (テーブル内座標、percentage)
const SLOT_POSITIONS: Record<Slot, CSSProperties> = {
  bottom_center: { bottom: '2%', left: '50%', transform: 'translateX(-50%)' },
  bottom_left: { bottom: '32%', left: '6%' },
  top_left: { top: '20%', left: '6%' },
  top_center: { top: '2%', left: '50%', transform: 'translateX(-50%)' },
  top_right: { top: '20%', right: '6%' },
  bottom_right: { bottom: '32%', right: '6%' },
};

// ポップアップは座席の「テーブル中央寄り」に配置 (transform で中心合わせ)。
const POPUP_OFFSETS: Record<Slot, CSSProperties> = {
  bottom_center: { bottom: '22%', left: '50%' },
  bottom_left: { bottom: '40%', left: '30%' },
  top_left: { top: '40%', left: '30%' },
  top_center: { top: '24%', left: '50%' },
  top_right: { top: '40%', right: '30%', transform: 'translate(50%, -50%)' },
  bottom_right: { bottom: '40%', right: '30%', transform: 'translate(50%, -50%)' },
};

// Dealer button は BTN 座席の内側 (テーブル中央寄り) に小さく
const DEALER_OFFSETS: Record<Slot, CSSProperties> = {
  bottom_center: { bottom: '8%', left: '64%' },
  bottom_left: { bottom: '38%', left: '34%' },
  top_left: { top: '26%', left: '34%' },
  top_center: { top: '8%', left: '60%' },
  top_right: { top: '26%', right: '34%' },
  bottom_right: { bottom: '38%', right: '34%' },
};
