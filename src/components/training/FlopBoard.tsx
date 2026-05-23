// フロップ3枚をテーブル中央に表示し、1枚ずつ横回転(scaleX)でフリップ登場させる。
// プリフロップのアクションアニメ完了後にマウントされ、その瞬間にフリップが走る。
// 裏面は描かず、横幅0(真横向き)→全幅へ回転して出現。テンポ重視で高速・連続。

import { type CSSProperties } from 'react';
import type { Card } from '../../types/card';
import { PlayingCard } from '../PlayingCard';

const FLIP_MS = 120; // 1枚あたりのフリップ時間
const FLIP_STAGGER_MS = 120; // 次のカードまでの間隔
const FLIP_KEYFRAMES = '@keyframes flopCardFlipIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }';

export function FlopBoard({ cards }: { cards: ReadonlyArray<Card> }) {
  return (
    <div style={wrapStyle}>
      <style>{FLIP_KEYFRAMES}</style>
      <span style={labelStyle}>フロップ</span>
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
const labelStyle: CSSProperties = {
  fontSize: '0.62rem',
  color: '#EAF3DE',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
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
