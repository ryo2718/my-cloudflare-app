import type { CSSProperties } from 'react';
import { EV_RANKING } from '../data/evRanking';
import { THEME } from '../styles/theme';
import { TIER_CONFIG } from '../utils/evTier';

interface Props {
  /** 169 hand notation (例: "AA", "AKs", "QJo")。null は未入力。 */
  hand: string | null;
}

/**
 * 入力ハンドの UTG オープン EV ランクを大きなティアバッジで表示。
 * - EV>0: 「上位 X.X%」 + ティア名
 * - EV=0: 「EV 0」 + トラッシュ
 * - データはビルド時生成 (src/data/evRanking.ts) — fetch 不要、即時表示
 */
export function EvRankDisplay({ hand }: Props) {
  if (!hand) {
    return (
      <div style={containerStyle}>
        <h3 style={titleStyle}>EVランク</h3>
        <p style={messageStyle}>ハンドを入力してください</p>
      </div>
    );
  }

  const info = EV_RANKING[hand];
  if (!info) {
    return (
      <div style={containerStyle}>
        <h3 style={titleStyle}>EVランク — {hand}</h3>
        <p style={messageStyle}>不明なハンド: {hand}</p>
      </div>
    );
  }

  const tier = TIER_CONFIG[info.tier];
  const isTrash = info.tier === 'trash';

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>EVランク — {hand}</h3>

      <div
        style={{
          background: tier.color,
          color: tier.textColor,
          border: `2px solid ${tier.borderColor}`,
          borderRadius: '0.5rem',
          padding: '1rem',
          textAlign: 'center',
          // 親 (height:100%) の余りスペースを取り、内容を縦中央寄せ
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            opacity: 0.85,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.4rem',
          }}
        >
          {isTrash ? 'EV 0' : `上位 ${info.topPct.toFixed(1)}%`}
        </div>
        <div
          style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {tier.name}
        </div>
        <div
          style={{
            fontSize: '0.85rem',
            opacity: 0.85,
            marginTop: '0.2rem',
          }}
        >
          ({tier.subtitle})
        </div>
      </div>

      <p style={noteStyle}>
        ※ EV は SB オープン基準です。ポジションにより前後します。
      </p>
    </div>
  );
}

const containerStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '1rem',
  // 親 grid (alignItems: stretch) に合わせて縦に伸ばし、
  // ティアバッジを縦中央に配置 (隣の HandInput の高さに揃える)
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

const titleStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: THEME.textPrimary,
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  color: THEME.textMuted,
  textAlign: 'center',
};

const noteStyle: CSSProperties = {
  margin: '0.75rem 0 0',
  fontSize: '0.7rem',
  color: THEME.textMuted,
  textAlign: 'center',
  fontStyle: 'italic',
};
