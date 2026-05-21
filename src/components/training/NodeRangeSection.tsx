// ノードファイルを読み込んで 13×13 ハンドレンジ (HandRangeMatrix) を表示する薄いローダ。
// 即時フィードバックの「その問題のノードの GTO レンジ表示」で全モード共通に再利用する。

import { useEffect, useState, type CSSProperties } from 'react';
import type { HandStrategy } from '../../data/training/preflopBeginner';
import { HandRangeMatrix } from './HandRangeMatrix';

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';
const cache: Record<string, Record<string, HandStrategy>> = {};

export interface NodeRangeSectionProps {
  /** 例 "utg.json" / "cor_bb.json"。null なら表示しない。 */
  file: string | null;
  /** 出題ハンド (強調表示)。 */
  highlightHand: string;
  caption?: string;
}

export function NodeRangeSection({ file, highlightHand, caption }: NodeRangeSectionProps) {
  const [hands, setHands] = useState<Record<string, HandStrategy> | null>(
    file && cache[file] ? cache[file] : null,
  );

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
      .then((data: { hands?: Record<string, HandStrategy> } | null) => {
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
  return (
    <div style={wrapStyle}>
      <HandRangeMatrix hands={hands} highlightHand={highlightHand} caption={caption} />
    </div>
  );
}

const wrapStyle: CSSProperties = { display: 'flex', justifyContent: 'center' };
