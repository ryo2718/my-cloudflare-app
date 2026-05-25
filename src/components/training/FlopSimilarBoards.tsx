// 「似たベット頻度のボード」紹介 (即時FB + 答え合わせで共有)。
// 正解サイズ構成が近いボードを数枚、ミニカード + 主要サイズの頻度チップで表示する。
// 「このボード群は同じ打ち方」という学びを与える。

import { type CSSProperties } from 'react';
import { PlayingCard } from '../PlayingCard';
import { THEME } from '../../styles/theme';
import type { SimilarBoard } from '../../data/training/flopIntermediateCb';
import { FLOP_CB_ORDER, flopSizeColor } from './flopCbChoiceStyle';

const SHOW_MIN = 0.1; // この頻度以上のサイズをチップ表示

const sizeLabel = (k: string): string => (k === 'check' ? 'check' : k === 'ALLIN' ? 'AI' : `${k}%`);

export function FlopSimilarBoards({ similar }: { similar: ReadonlyArray<SimilarBoard> }) {
  if (similar.length === 0) return null;
  return (
    <div style={wrapStyle}>
      <span style={headingStyle}>似たベット頻度のボード</span>
      <div style={listStyle}>
        {similar.map((s, i) => (
          <div key={i} style={rowStyle}>
            <div style={cardsStyle}>
              {s.board.map((c, j) => (
                <PlayingCard key={j} rank={c.rank} suit={c.suit} size="sm" />
              ))}
            </div>
            <div style={chipsStyle}>
              {FLOP_CB_ORDER.filter((k) => (s.strat[k] ?? 0) >= SHOW_MIN).map((k) => (
                <span key={k} style={chipStyle}>
                  <span style={{ ...dotStyle, background: flopSizeColor(k) }} />
                  {sizeLabel(k)} {Math.round((s.strat[k] ?? 0) * 100)}%
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' };
const headingStyle: CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: THEME.textSecondary };
const listStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.4rem' };
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' };
const cardsStyle: CSSProperties = { display: 'flex', gap: 3, flexShrink: 0 };
const chipsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.25rem' };
const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.2rem',
  fontSize: '0.72rem',
  fontWeight: 600,
  color: THEME.textPrimary,
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: 999,
  padding: '0.1rem 0.4rem',
  fontVariantNumeric: 'tabular-nums',
};
const dotStyle: CSSProperties = { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' };
