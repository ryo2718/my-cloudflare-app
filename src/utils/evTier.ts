import type { EvTier } from '../data/evRanking';

export interface TierConfig {
  /** 表示名 (例: "プレミアム") */
  name: string;
  /** サブタイトル (例: "最強") */
  subtitle: string;
  /** カード背景色 */
  color: string;
  /** カード文字色 (背景に対するコントラスト確保) */
  textColor: string;
  /** カード枠線色 */
  borderColor: string;
}

export const TIER_CONFIG: Record<EvTier, TierConfig> = {
  premium: {
    name: 'プレミアム',
    subtitle: '最強',
    color: '#fde047',       // 明るいレモン金
    textColor: '#422006',   // 暗い茶 (高コントラスト)
    borderColor: '#facc15', // 一段濃い黄 (枠を視認可)
  },
  elite: {
    name: 'エリート',
    subtitle: '超強',
    color: '#e74c3c', // 赤
    textColor: '#fff',
    borderColor: '#c0392b',
  },
  strong: {
    name: 'ストロング',
    subtitle: '強い',
    color: '#e67e22', // 橙
    textColor: '#fff',
    borderColor: '#d35400',
  },
  good: {
    name: 'グッド',
    subtitle: '良好',
    color: '#f39c12', // 黄橙
    textColor: '#3d2a08',
    borderColor: '#b9770e',
  },
  standard: {
    name: 'スタンダード',
    subtitle: '標準',
    color: '#27ae60', // 緑
    textColor: '#fff',
    borderColor: '#1e8449',
  },
  average: {
    name: 'アベレージ',
    subtitle: '並',
    color: '#16a085', // 青緑
    textColor: '#fff',
    borderColor: '#117864',
  },
  weak: {
    name: 'ウィーク',
    subtitle: '弱め',
    color: '#3498db', // 青
    textColor: '#fff',
    borderColor: '#2874a6',
  },
  marginal: {
    name: 'マージナル',
    subtitle: '際どい',
    color: '#2980b9', // 濃青
    textColor: '#fff',
    borderColor: '#21618c',
  },
  poor: {
    name: 'プア',
    subtitle: '弱い',
    color: '#5e35b1', // 紫
    textColor: '#fff',
    borderColor: '#4527a0',
  },
  garbage: {
    name: 'ゴミハンド',
    subtitle: 'プレイ厳禁',
    color: '#3b0a0a',        // 深い赤茶 (危険シグナル)
    textColor: '#d4a1a1',
    borderColor: '#1d0505',
  },
  trash: {
    name: 'トラッシュ',
    subtitle: 'EV 0',
    color: '#1a1a1a', // 黒
    textColor: '#888',
    borderColor: '#0d0d0d',
  },
};
