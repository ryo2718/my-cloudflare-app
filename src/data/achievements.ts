// 実績マスタ (クライアント表示用)。 サーバー側 functions/lib/achievements.ts の
// 解除判定ロジックと achievement_id が一致している必要がある。
//
// ※ ティアの内部 id (shrimp/fish/shark/whale) はファイル名 / URL パスで使うため不変。
//    UI 表示名 (label) は 「ビギナー / スタンダード / プロフェッショナル / マスター」。
// ※ shark / whale (プロフェッショナル / マスター) は未実装。 判定ロジックも置かない。
//    AchievementTierPage で「未実装」表記、 タップ不可。

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
  /** 鯨ティアのみ true (右上に ★ マーク)。 */
  star?: boolean;
  /** 実績が定義されているか。 false なら「未実装」表示、 ランク昇格条件にも含めない。 */
  implemented: boolean;
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
    label: 'ビギナー',
    sublabel: '',
    image: shrimpImg,
    bg: '#C0DD97',
    border: '#639922',
    textColor: '#27500A',
    implemented: true,
  },
  {
    id: 'fish',
    label: 'スタンダード',
    sublabel: '',
    image: fishImg,
    bg: '#FAC775',
    border: '#BA7517',
    textColor: '#633806',
    implemented: true,
  },
  {
    id: 'shark',
    label: 'プロフェッショナル',
    sublabel: '未実装',
    image: sharkImg,
    bg: '#E24B4A',
    border: '#A32D2D',
    textColor: '#ffffff',
    implemented: false,
  },
  {
    id: 'whale',
    label: 'マスター',
    sublabel: '未実装',
    image: whaleImg,
    bg: '#534AB7',
    border: '#FAC775',
    textColor: '#ffffff',
    star: true,
    implemented: false,
  },
];

// 実績 5 件 (ビギナー 3 + スタンダード 2)。
// プロ / マスターは未実装 — ACHIEVEMENTS から省く。 サーバー側判定ロジックも空。
// 将来「単語トレーニング」が追加された場合、 説明文は「プリフロップ◯◯」と明示しているので
// 単語トレーニング用の実績を別 tier で追加できる。
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'shrimp_1', tier: 'shrimp', name: 'Welcome!',         desc: 'トレーニングモードを初めてプレイ' },
  { id: 'shrimp_2', tier: 'shrimp', name: '初心者脱出!',     desc: 'プリフロップトレーニングで初級をクリア (20/20)' },
  { id: 'shrimp_3', tier: 'shrimp', name: 'スタートダッシュ', desc: 'トレーニングモードを 10 回以上プレイ' },

  { id: 'fish_1',   tier: 'fish',   name: '中級者デビュー',   desc: 'プリフロップ中級で正答率 50% 以上 (20pt 以上)' },
  { id: 'fish_2',   tier: 'fish',   name: 'プロへの入り口',   desc: 'プリフロップ中級をクリア (32pt 以上、 80%)' },
];

export function tierById(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function achievementsByTier(tier: TierId): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.tier === tier);
}
