import type { CSSProperties } from 'react';
import type { Action } from '../../types/strategy';

interface Props {
  hand: string;
  freqs: number[];
  actions: Action[];
  position: { top: number; left: number; width: number; height: number };
}

/**
 * 長押し pin 表示の拡大ポップアップ。
 *  - 黄色 3px 枠
 *  - 全体の背景 = 元セルと同じ縦割りグラデーション (黒背景は使わない)
 *  - 上部にハンド名 (白太字 + 黒halo の textShadow で薄色背景でも可読)
 *  - 下部にアクション一覧 (白文字 + 同 textShadow)
 *  - pointer-events:'none' なので外側タップ判定をブロックしない
 */
export function HandPopup({ hand, freqs, actions, position }: Props) {
  // 元セルと同じ縦割りグラデーション (linear-gradient to top + 累積 stops)
  let cumulative = 0;
  const stops: string[] = [];
  freqs.forEach((freq, i) => {
    if (freq <= 0) return;
    const start = cumulative * 100;
    cumulative += freq;
    const end = cumulative * 100;
    stops.push(`${actions[i].color} ${start}%, ${actions[i].color} ${end}%`);
  });
  const cellBg = stops.length > 0 ? `linear-gradient(to top, ${stops.join(', ')})` : '#9ca3af';

  // アクション一覧を spec 表示順 (All-in → Raise → Call → Fold) で並べ替え
  const ORDER = ['allin', 'raise', 'call', 'fold'] as const;
  const rows = ORDER.map((id) => {
    const idx = actions.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const a = actions[idx];
    return { id, label: a.label, sizeBB: a.size_bb, freq: freqs[idx] ?? 0 };
  }).filter(Boolean) as Array<{ id: string; label: string; sizeBB: number; freq: number }>;

  return (
    <div
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
        border: '3px solid #fbbf24',
        borderRadius: '6px',
        zIndex: 1000,
        background: cellBg, // ← 黒背景なし、セルと同じグラデーションのまま
        pointerEvents: 'none',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={headerStyle}>{hand}</div>
      <div style={{ flex: 1 }} />
      <div style={listStyle}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
            <span>
              {r.label}
              {r.sizeBB > 1 ? ` ${r.sizeBB}` : ''}
            </span>
            <span>{(r.freq * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 共通: 白文字 + 強い黒halo で、薄色背景上でも可読
const TEXT_SHADOW =
  '0 1px 2px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,0.6)';

const headerStyle: CSSProperties = {
  color: '#ffffff',
  padding: '4px 6px',
  fontSize: '15px',
  fontWeight: 700,
  textAlign: 'center',
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  textShadow: TEXT_SHADOW,
  letterSpacing: '0.02em',
};

const listStyle: CSSProperties = {
  color: '#ffffff',
  padding: '4px 6px 6px',
  fontSize: '10px',
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  textShadow: TEXT_SHADOW,
};
