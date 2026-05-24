// フロップ3枚をテーブル中央に表示し、1枚ずつ横回転(scaleX)でフリップ登場させる。
// プリフロップのアクションアニメ完了後にマウントされ、その瞬間にフリップが走る。
// 裏面は描かず、横幅0(真横向き)→全幅へ回転して出現。テンポ重視で高速・連続。

import { type CSSProperties } from 'react';
import type { Card } from '../../types/card';
import type { FlopPot } from '../../data/training/flopBeginner';
import { potPillColor } from './flopFeedbackFormat';
import { PlayingCard } from '../PlayingCard';

const FLIP_MS = 120; // 1枚あたりのフリップ時間
const FLIP_STAGGER_MS = 120; // 次のカードまでの間隔
const FLIP_KEYFRAMES = '@keyframes flopCardFlipIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }';

export function FlopBoard({ cards, pot }: { cards: ReadonlyArray<Card>; pot: FlopPot }) {
  const pill = potPillColor(pot);
  return (
    <div style={wrapStyle}>
      <style>{FLIP_KEYFRAMES}</style>
      <span style={{ ...pillStyle, background: pill.bg, color: pill.fg }}>
        {pot === 'SRP' ? 'SRP' : '3bp'}
      </span>
      <div style={rowStyle}>
        {cards.map((c, i) => (
          <span
            key={`${c.rank}${c.suit}-${i}`}
            style={{ ...cardStyle, animationDelay: `${i * FLIP_STAGGER_MS}ms` }}
          >
            <PlayingCard rank={c.rank} suit={c.suit} size="md" />
          </span>
        ))}
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.2rem',
};
// ポット種別ピル: 色は potPillColor(pot) で決定 (SRP=クリーム / 3bp=赤系オレンジ)。
// 紫はオールイン/ポットオーバー専用のため使わない。
const pillStyle: CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  padding: '2px 9px',
  borderRadius: 999,
  boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
};
const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 5,
};
const cardStyle: CSSProperties = {
  display: 'inline-block',
  transformOrigin: 'center',
  animationName: 'flopCardFlipIn',
  animationDuration: `${FLIP_MS}ms`,
  animationTimingFunction: 'ease-out',
  animationFillMode: 'both',
};
