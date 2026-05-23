// 6max ポーカーテーブル俯瞰図 (プレゼンテーション専用)。
//
// チップは廃止。各ポジションのアクションを「テキストポップアップ」(fold / raise 2.5 / call /
// limp / allin) で表示する。表示するアクションは popups (= 各座席の最新アクション) で渡す。
// アニメーション (0.2 秒間隔の順次表示) や action_history の読み込みは ActionTable 側で行う。
//
// 配置: 自分 (mePosition) は下中央、他 5 名を時計回りに配置。

import type { CSSProperties, ReactNode } from 'react';
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
  /**
   * テーブル中央に置く要素 (フロップ3枚等)。指定時は楕円を広げて中央に配置する。
   * 未指定 (プリフロップ) のときは従来どおり。
   */
  centerSlot?: ReactNode;
  /**
   * 中央スロット用に最初から楕円を広げておく (centerSlot がまだ無い再生中も拡大維持)。
   * フロップ初級でテーブルサイズがフロップ表示時に変化しないようにするため。
   */
  wide?: boolean;
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

export function PokerTable({ mePosition, popups = [], centerSlot, wide = false }: PokerTableProps) {
  const slots = arrangePositions(mePosition);
  const popupByPos = new Map<Position, SeatPopup>();
  for (const p of popups) popupByPos.set(p.position, p);
  const useWide = wide || !!centerSlot;

  return (
    <div style={containerStyle}>
      <div style={useWide ? tableWideStyle : tableStyle} aria-label="ポーカーテーブル">
        {centerSlot && <div style={centerSlotStyle}>{centerSlot}</div>}
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
    // ブラインドのみ枠を少し強調 (白地のため)。アクションはベタ塗りで枠は地色と同色。
    borderWidth: kind === 'blind' ? '1.5px' : '1px',
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

// 中央スロット (フロップ3枚) がある場合は楕円を広げる。
const tableWideStyle: CSSProperties = {
  ...tableStyle,
  maxWidth: 440,
  aspectRatio: '7 / 5',
};

// 中央スロット: 楕円の中央やや上に配置。各席ポップアップ (中央寄り 30〜40%) と重ならないよう
// 縦中央帯 (≈45%) に置き、上下中央ポップアップ (top24% / bottom22%) とも分離する。
const centerSlotStyle: CSSProperties = {
  position: 'absolute',
  top: '46%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  zIndex: 2,
  pointerEvents: 'none',
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
  border: '1px solid',
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

// Dealer button は BTN 座席の「内側」(中央寄り、BTN 円とアクションラベルの間) に配置。
const DEALER_OFFSETS: Record<Slot, CSSProperties> = {
  bottom_center: { bottom: '14%', left: '58%' },
  bottom_left: { bottom: '36%', left: '20%' },
  top_left: { top: '30%', left: '20%' },
  top_center: { top: '14%', left: '58%' },
  top_right: { top: '30%', right: '20%' },
  bottom_right: { bottom: '36%', right: '20%' },
};
