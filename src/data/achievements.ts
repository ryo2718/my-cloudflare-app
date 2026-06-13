// 実績マスタ (クライアント表示用)。 サーバー側 functions/lib/achievements.ts の
// 解除判定ロジックと achievement_id が一致している必要がある。
//
// ※ ティアの内部 id (shrimp/fish/shark/whale) はファイル名 / URL パスで使うため不変。
//    UI 表示名 (label) は 「ビギナー / スタンダード / プロフェッショナル / マスター」。
// ※ shark (プロフェッショナル) は実績 7 個を「判定・記録のみ」行う (tier.implemented=false の
//    まま)。 UI では「未実装」表記・タップ不可、 ランク到達ロジックにも含めない (= 最高ランクは
//    スタンダードまで)。 whale (マスター) は実績未定義。

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
  /**
   * このランク到達に必要な「達成済み実績数」。 未指定なら全実績必須。
   * (スタンダードは 11 個中 8 個で到達 = 部分達成許容。)
   */
  rankThreshold?: number;
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
    rankThreshold: 8, // 11 個中 8 個で到達 (部分達成許容)
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

// 実績 21 件 (ビギナー 3 + スタンダード 11 + プロフェッショナル 7)。
// マスター (whale) は未定義。 プロ (shark) は判定・記録のみ (ランクUI非表示)。
export const ACHIEVEMENTS: Achievement[] = [
  // ビギナー (変更なし)。
  { id: 'shrimp_1', tier: 'shrimp', name: 'Welcome!',         desc: 'トレーニングモードを初めてプレイ' },
  { id: 'shrimp_2', tier: 'shrimp', name: '初心者脱出!',     desc: 'プリフロップトレーニングで初級をクリア (20/20)' },
  { id: 'shrimp_3', tier: 'shrimp', name: 'スタートダッシュ', desc: 'トレーニングモードを 10 回以上プレイ' },

  // スタンダード (fish): 各モードを 初級90% / 中級80% で達成。計 11 個 (8 個でランク到達)。
  { id: 'fish_pf_open',        tier: 'fish', name: 'オープン上手',        desc: '初級 オープンで 90% (18/20)' },
  { id: 'fish_pf_vs_open',     tier: 'fish', name: 'vs オープン上手',     desc: '初級 vs オープンで 90% (18/20)' },
  { id: 'fish_pf_vs_3bet_4bet', tier: 'fish', name: 'vs 3ベット上手',     desc: '初級 vs 3ベット/4ベットで 90% (18/20)' },
  { id: 'fish_flop_beginner',  tier: 'fish', name: 'フロップ初級突破',    desc: 'フロップ初級で 90% (18/20)' },
  { id: 'fish_pf_intermediate', tier: 'fish', name: '中級者デビュー',     desc: 'プリフロップ中級 総合で 80% (32/40)' },
  { id: 'fish_pf_ep',          tier: 'fish', name: '中級 EP 80%',         desc: 'プリフロップ中級 EP で 80% (16/20)' },
  { id: 'fish_pf_lp',          tier: 'fish', name: '中級 LP 80%',         desc: 'プリフロップ中級 LP で 80% (16/20)' },
  { id: 'fish_pf_blind',       tier: 'fish', name: '中級 Blind 80%',      desc: 'プリフロップ中級 Blind で 80% (24/30)' },
  { id: 'fish_flop_cb_srp',    tier: 'fish', name: 'レンジCB SRP 80%',    desc: 'フロップ レンジCB SRP で 80% (48/60)' },
  { id: 'fish_flop_cb_3bp',    tier: 'fish', name: 'レンジCB 3BP 80%',    desc: 'フロップ レンジCB 3BP/4BP/5BP で 80% (48/60)' },
  { id: 'fish_flop_donk',      tier: 'fish', name: 'レンジドンク 80%',    desc: 'フロップ レンジドンク/BMCB で 80% (48/60)' },

  // プロフェッショナル (shark): 中級各モードを 100%。計 7 個 (判定・記録のみ。ランクUI未実装)。
  { id: 'shark_pf_intermediate', tier: 'shark', name: '中級 総合 完全制覇', desc: 'プリフロップ中級 総合で 100% (40/40)' },
  { id: 'shark_pf_ep',          tier: 'shark', name: '中級 EP 完全制覇',   desc: 'プリフロップ中級 EP で 100% (20/20)' },
  { id: 'shark_pf_lp',          tier: 'shark', name: '中級 LP 完全制覇',   desc: 'プリフロップ中級 LP で 100% (20/20)' },
  { id: 'shark_pf_blind',       tier: 'shark', name: '中級 Blind 完全制覇', desc: 'プリフロップ中級 Blind で 100% (30/30)' },
  { id: 'shark_flop_cb_srp',    tier: 'shark', name: 'レンジCB SRP 完全制覇', desc: 'フロップ レンジCB SRP で 100% (60/60)' },
  { id: 'shark_flop_cb_3bp',    tier: 'shark', name: 'レンジCB 3BP 完全制覇', desc: 'フロップ レンジCB 3BP/4BP/5BP で 100% (60/60)' },
  { id: 'shark_flop_donk',      tier: 'shark', name: 'レンジドンク 完全制覇', desc: 'フロップ レンジドンク/BMCB で 100% (60/60)' },
];

export function tierById(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function achievementsByTier(tier: TierId): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.tier === tier);
}
