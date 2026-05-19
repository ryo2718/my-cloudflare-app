// 実績マスタ (クライアント表示用)。 サーバー側 functions/lib/achievements.ts の
// 解除判定ロジックと achievement_id が一致している必要がある。
//
// ※ 実績の名前・説明は仮設定。 ユーザーが確定したら以下の ACHIEVEMENTS 配列を編集する。
//    判定ロジックを変える場合はサーバー側 functions/lib/achievements.ts も合わせて更新。

import shrimpImg from '../assets/tiers/shrimp.png';
import fishImg from '../assets/tiers/fish.png';
import sharkImg from '../assets/tiers/shark.png';
import whaleImg from '../assets/tiers/whale.png';

export type TierId = 'shrimp' | 'fish' | 'shark' | 'whale';

export interface Tier {
  id: TierId;
  label: string;
  sublabel: string;
  image: string;
  bg: string;
  border: string;
  textColor: string;
  /** 鯨ティアのみ true (右上に ★ マークを表示)。 */
  star?: boolean;
}

export interface Achievement {
  id: string;
  tier: TierId;
  name: string;
  desc: string;
}

export const TIERS: Tier[] = [
  {
    id: 'shrimp',
    label: 'エビ',
    sublabel: '初心者',
    image: shrimpImg,
    bg: '#C0DD97',
    border: '#639922',
    textColor: '#27500A',
  },
  {
    id: 'fish',
    label: '魚',
    sublabel: '中級者',
    image: fishImg,
    bg: '#FAC775',
    border: '#BA7517',
    textColor: '#633806',
  },
  {
    id: 'shark',
    label: '鮫',
    sublabel: '上級者',
    image: sharkImg,
    bg: '#E24B4A',
    border: '#A32D2D',
    textColor: '#ffffff',
  },
  {
    id: 'whale',
    label: '鯨',
    sublabel: 'マスター',
    image: whaleImg,
    bg: '#534AB7',
    border: '#FAC775',
    textColor: '#ffffff',
    star: true,
  },
];

// 仮設定 — ユーザー調整待ち。 サーバー判定 (functions/lib/achievements.ts) の id 列と一致。
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'shrimp_1', tier: 'shrimp', name: 'ビギナー',           desc: 'トレーニングモードをプレイ' },
  { id: 'shrimp_2', tier: 'shrimp', name: '初心者脱出',         desc: '初級モードをクリア (20/20)' },
  { id: 'shrimp_3', tier: 'shrimp', name: 'トータル10回到達',   desc: 'トレーニングモードを 10 回以上プレイ' },

  { id: 'fish_1',   tier: 'fish',   name: '中級デビュー',       desc: '中級モードをプレイ' },
  { id: 'fish_2',   tier: 'fish',   name: '中級合格',           desc: '中級モードで 20pt 以上獲得' },
  { id: 'fish_3',   tier: 'fish',   name: '中級マスター',       desc: '中級モードで 30pt 以上獲得' },

  { id: 'shark_1',  tier: 'shark',  name: '中級満点',           desc: '中級モードで 40pt (満点) 獲得' },
  { id: 'shark_2',  tier: 'shark',  name: 'ポジション制覇',     desc: '全ポジションで正答率 80% 以上' },
  { id: 'shark_3',  tier: 'shark',  name: '継続の達人',         desc: '7 日連続でトレーニング' },

  { id: 'whale_1',  tier: 'whale',  name: 'パーフェクト達成',   desc: '中級モードで 40pt 達成 3 回' },
  { id: 'whale_2',  tier: 'whale',  name: 'シーズン王者',       desc: '1 シーズンでランキング 1 位' },
  { id: 'whale_3',  tier: 'whale',  name: '殿堂入り',           desc: '累計 500pt 達成' },
];

export function tierById(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function achievementsByTier(tier: TierId): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.tier === tier);
}
