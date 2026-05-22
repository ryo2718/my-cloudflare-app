// ノードファイルを読み込み、13×13 ハンドレンジ + 選択ハンドのアクション頻度内訳を表示する。
// 即時フィードバック / 答え合わせで全モード共通に再利用 (既存 HandRangeMatrix を拡張利用)。
//   - 既定の選択ハンド = 出題ハンド (highlightHand) の頻度内訳を表示 (修正1)
//   - レンジ表のセルをタップすると、そのハンドの頻度内訳に切り替わる (修正2)
//   - 同じセル再タップで出題ハンドに戻す

import { useEffect, useState, type CSSProperties } from 'react';
import type { HandStrategy } from '../../data/training/preflopBeginner';
import { HandRangeMatrix } from './HandRangeMatrix';
import { handActionFrequencies, actionBarColor, barWidthPct, type FreqMap } from '../../data/training/actionFrequencies';
import { loadNodeHands, cachedNodeHands } from '../../data/training/gtoNodeCache';
import { THEME } from '../../styles/theme';

export interface NodeRangeSectionProps {
  /** 例 "utg.json" / "cor_bb.json"。null なら表示しない。 */
  file: string | null;
  /** 出題ハンド (強調表示 + 既定の頻度表示対象)。 */
  highlightHand: string;
  caption?: string;
  /** アクションラベル上書き (例 SB open の call → 「リンプ」)。 */
  actionLabels?: Partial<Record<string, string>>;
}

export function NodeRangeSection({ file, highlightHand, caption, actionLabels }: NodeRangeSectionProps) {
  const [hands, setHands] = useState<Record<string, FreqMap> | null>(
    file ? ((cachedNodeHands(file) as unknown as Record<string, FreqMap> | undefined) ?? null) : null,
  );
  const [selected, setSelected] = useState<string>(highlightHand);

  // 出題ハンド/ノードが変わったら選択を出題ハンドに戻す。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(highlightHand);
  }, [highlightHand, file]);

  useEffect(() => {
    if (!file) return;
    const hit = cachedNodeHands(file);
    if (hit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHands(hit as unknown as Record<string, FreqMap>);
      return;
    }
    let cancelled = false;
    // 取得失敗時は silent (レンジ表を出さない) — 従来の NodeRangeSection 挙動を維持。
    loadNodeHands(file)
      .then((h) => {
        if (!cancelled) setHands(h as unknown as Record<string, FreqMap>);
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!hands) return null;

  const rows = handActionFrequencies(hands, selected, actionLabels);
  const toggle = (hand: string) => setSelected((cur) => (cur === hand ? highlightHand : hand));

  return (
    <div style={wrapStyle}>
      <HandRangeMatrix
        hands={hands as unknown as Record<string, HandStrategy>}
        highlightHand={highlightHand}
        selectedHand={selected}
        onSelect={toggle}
        caption={caption}
      />
      {rows.length > 0 && (
        <div style={freqWrapStyle}>
          <div style={freqTitleStyle}>{selected}</div>
          {rows.map((r) => (
            <div key={r.action} style={freqRowStyle}>
              <span style={freqLabelStyle}>{r.label}</span>
              <div style={barTrackStyle}>
                <div
                  style={{ ...barFillStyle, width: `${barWidthPct(r.pct)}%`, background: actionBarColor(r.action) }}
                />
              </div>
              <span style={freqPctStyle}>{formatPct(r.pct)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPct(pct: number): string {
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

const wrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' };
const freqWrapStyle: CSSProperties = {
  width: '100%',
  maxWidth: 280,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};
const freqTitleStyle: CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 800,
  color: THEME.textPrimary,
  textAlign: 'center',
  marginBottom: '0.1rem',
};
const freqRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
  color: THEME.textPrimary,
};
const freqLabelStyle: CSSProperties = { width: '5em', flexShrink: 0 };
const barTrackStyle: CSSProperties = {
  flex: 1,
  height: 10,
  background: THEME.cellEmpty,
  borderRadius: 5,
  overflow: 'hidden',
};
const barFillStyle: CSSProperties = { height: '100%', borderRadius: 5 };
const freqPctStyle: CSSProperties = {
  width: '3em',
  textAlign: 'right',
  flexShrink: 0,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};
