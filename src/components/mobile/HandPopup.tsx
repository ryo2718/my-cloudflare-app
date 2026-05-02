import type { CSSProperties } from 'react';
import type { Action } from '../../types/strategy';

interface Props {
  hand: string;
  freqs: number[];
  actions: Action[];
  position: { top: number; left: number; width: number; height: number };
}

/**
 * 長押し時に表示する拡大ポップアップ。
 * - 黄色 3px 枠 (選択ハイライト)
 * - 上部: ハンド名 (白太字)
 * - 中央 (約60%): 元セルと同じ縦割りグラデーション
 * - 下部 (約40%): All-in / Raise / Call / Fold の頻度一覧
 *
 * pointer-events:'none' なので長押し中の操作 (onTouchEnd 等) を遮らない。
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
  const barBg = stops.length > 0 ? `linear-gradient(to top, ${stops.join(', ')})` : '#9ca3af';

  // アクション一覧を spec の表示順 (All-in → Raise → Call → Fold) で並び替え
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
        background: '#1f2937',
        pointerEvents: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
      }}
    >
      <div style={headerStyle}>{hand}</div>
      <div style={{ flex: 60, background: barBg }} />
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

const headerStyle: CSSProperties = {
  background: 'rgba(0, 0, 0, 0.65)',
  color: '#ffffff',
  padding: '4px 6px',
  fontSize: '15px',
  fontWeight: 700,
  textAlign: 'center',
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
  letterSpacing: '0.02em',
};

const listStyle: CSSProperties = {
  flex: 40,
  background: 'rgba(0, 0, 0, 0.75)',
  color: '#ffffff',
  padding: '4px 6px',
  fontSize: '10px',
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-around',
};
