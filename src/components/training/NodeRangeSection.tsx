// ノードファイルを読み込み、13×13 ハンドレンジ + 選択ハンドのアクション頻度内訳を表示する。
// 即時フィードバック / 答え合わせで全モード共通に再利用 (既存 HandRangeMatrix を拡張利用)。
//   - 既定の選択ハンド = 出題ハンド (highlightHand) の頻度内訳を表示 (修正1)
//   - レンジ表のセルをタップすると、そのハンドの頻度内訳に切り替わる (修正2)
//   - 同じセル再タップで出題ハンドに戻す

import { useEffect, useState, type CSSProperties } from 'react';
import type { HandStrategy } from '../../data/training/preflopBeginner';
import { HandRangeMatrix } from './HandRangeMatrix';
import { handActionFrequencies, type FreqMap } from '../../data/training/actionFrequencies';
import { THEME } from '../../styles/theme';

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';
const cache: Record<string, Record<string, FreqMap>> = {};

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
  const [hands, setHands] = useState<Record<string, FreqMap> | null>(file && cache[file] ? cache[file] : null);
  const [selected, setSelected] = useState<string>(highlightHand);

  // 出題ハンド/ノードが変わったら選択を出題ハンドに戻す。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(highlightHand);
  }, [highlightHand, file]);

  useEffect(() => {
    if (!file) return;
    if (cache[file]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHands(cache[file]);
      return;
    }
    let cancelled = false;
    fetch(`${PREFLOP_DATA_ROOT}/${file}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { hands?: Record<string, FreqMap> } | null) => {
        if (cancelled || !data?.hands) return;
        cache[file] = data.hands;
        setHands(data.hands);
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
              <span>{r.label}</span>
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
  maxWidth: 260,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
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
  justifyContent: 'space-between',
  fontSize: '0.88rem',
  color: THEME.textPrimary,
};
const freqPctStyle: CSSProperties = { fontWeight: 700, fontVariantNumeric: 'tabular-nums' };
