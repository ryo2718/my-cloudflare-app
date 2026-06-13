// 実績マスタ (クライアント表示用)。 サーバー側 functions/lib/achievements.ts の
// 解除判定ロジックと achievement_id が一致している必要がある。
//
// ※ ティアの内部 id (shrimp/fish/shark/whale) はファイル名 / URL パスで使うため不変。
//    UI 表示名 (label) は 「ビギナー / スタンダード / プロフェッショナル / マスター」。
// ※ shark (プロフェッショナル) は実績 9 個を「判定・記録のみ」行う (tier.implemented=false の
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
   * (スタンダードは 13 個中 10 個で到達 = 部分達成許容。)
   */
  rankThreshold?: number;
}

export interface Achievement {
  id: string;
  tier: TierId;
  name: string;
  desc: string;
  /** 進捗(現在の最高点数%)計算対象の training_type。 累計系 (初回プレイ/10回) は未指定。 */
  trainingType?: string;
  /**
   * best_score の満点 (= 現在% の分母)。 trainingType 指定時に使う。
   * ※ オープンは best_score が 0-20 (正解数) なので 20 (pt 表示の 10 ではない)。
   */
  maxBest?: number;
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
    rankThreshold: 10, // 13 個中 10 個で到達 (部分達成許容)
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

// 実績 25 件 (ビギナー 3 + スタンダード 13 + プロフェッショナル 9)。
// マスター (whale) は未定義。 プロ (shark) は判定・記録のみ (ランクUI非表示)。
export const ACHIEVEMENTS: Achievement[] = [
  // ビギナー (キー固定)。 shrimp_2 のみ進捗% を表示。
  { id: 'shrimp_1', tier: 'shrimp', name: 'Welcome!',         desc: 'トレーニングモードを初めてプレイ' },
  { id: 'shrimp_2', tier: 'shrimp', name: '初心者脱出!',     desc: 'プリフロップ初級で 100% (20/20)', trainingType: 'preflop_beginner', maxBest: 20 },
  { id: 'shrimp_3', tier: 'shrimp', name: 'スタートダッシュ', desc: 'トレーニングモードを 10 回以上プレイ' },

  // スタンダード (fish): 各モードを 初級90% / 中級80% で達成。計 13 個 (10 個でランク到達)。
  // 名前は「{カテゴリ} {階級} {モード} {目標%}」形式 (どのトレーニングか一目で分かるように)。
  { id: 'fish_pf_open',        tier: 'fish', name: 'プリフロップ 初級 オープン 90%',        desc: '90% (18/20)', trainingType: 'preflop_beginner_open', maxBest: 20 },
  { id: 'fish_pf_vs_open',     tier: 'fish', name: 'プリフロップ 初級 vsオープン 90%',      desc: '90% (18/20)', trainingType: 'preflop_beginner_vs_open', maxBest: 20 },
  { id: 'fish_pf_vs_3bet_4bet', tier: 'fish', name: 'プリフロップ 初級 vs3ベット/4ベット 90%', desc: '90% (18/20)', trainingType: 'preflop_beginner_vs_3bet_4bet', maxBest: 20 },
  { id: 'fish_flop_beginner',  tier: 'fish', name: 'ポストフロップ 初級 90%',               desc: '90% (18/20)', trainingType: 'flop_beginner', maxBest: 20 },
  { id: 'fish_pf_intermediate', tier: 'fish', name: 'プリフロップ 中級 総合 80%',           desc: '80% (32/40)', trainingType: 'preflop_intermediate', maxBest: 40 },
  { id: 'fish_pf_ep',          tier: 'fish', name: 'プリフロップ 中級 EP 80%',              desc: '80% (16/20)', trainingType: 'preflop_intermediate_ep', maxBest: 20 },
  { id: 'fish_pf_lp',          tier: 'fish', name: 'プリフロップ 中級 LP 80%',              desc: '80% (16/20)', trainingType: 'preflop_intermediate_lp', maxBest: 20 },
  { id: 'fish_pf_blind',       tier: 'fish', name: 'プリフロップ 中級 Blind 80%',           desc: '80% (24/30)', trainingType: 'preflop_intermediate_blind', maxBest: 30 },
  { id: 'fish_flop_srp_non_blind',         tier: 'fish', name: 'ポストフロップ 中級 SRP Blind以外 80%',     desc: '80% (32/40)', trainingType: 'srp_non_blind', maxBest: 40 },
  { id: 'fish_flop_srp_limp_blind',        tier: 'fish', name: 'ポストフロップ 中級 SRP リンプ&Blind 80%', desc: '80% (32/40)', trainingType: 'srp_limp_blind', maxBest: 40 },
  { id: 'fish_flop_3bp_4bp_5bp_non_blind', tier: 'fish', name: 'ポストフロップ 中級 3BP/4BP Blind以外 80%', desc: '80% (32/40)', trainingType: '3bp_4bp_5bp_non_blind', maxBest: 40 },
  { id: 'fish_flop_3bp_4bp_5bp_blind',     tier: 'fish', name: 'ポストフロップ 中級 3BP/4BP/5BP Blind 80%', desc: '80% (32/40)', trainingType: '3bp_4bp_5bp_blind', maxBest: 40 },
  { id: 'fish_flop_donk_bmcb',             tier: 'fish', name: 'ポストフロップ 中級 ドンク/BMCB 80%',       desc: '80% (32/40)', trainingType: 'donk_bmcb', maxBest: 40 },

  // プロフェッショナル (shark): 中級各モードを 100%。計 9 個 (判定・記録のみ。ランクUI未実装)。
  { id: 'shark_pf_intermediate', tier: 'shark', name: 'プリフロップ 中級 総合 100%',          desc: '100% (40/40)', trainingType: 'preflop_intermediate', maxBest: 40 },
  { id: 'shark_pf_ep',          tier: 'shark', name: 'プリフロップ 中級 EP 100%',             desc: '100% (20/20)', trainingType: 'preflop_intermediate_ep', maxBest: 20 },
  { id: 'shark_pf_lp',          tier: 'shark', name: 'プリフロップ 中級 LP 100%',             desc: '100% (20/20)', trainingType: 'preflop_intermediate_lp', maxBest: 20 },
  { id: 'shark_pf_blind',       tier: 'shark', name: 'プリフロップ 中級 Blind 100%',          desc: '100% (30/30)', trainingType: 'preflop_intermediate_blind', maxBest: 30 },
  { id: 'shark_flop_srp_non_blind',         tier: 'shark', name: 'ポストフロップ 中級 SRP Blind以外 100%',     desc: '100% (40/40)', trainingType: 'srp_non_blind', maxBest: 40 },
  { id: 'shark_flop_srp_limp_blind',        tier: 'shark', name: 'ポストフロップ 中級 SRP リンプ&Blind 100%', desc: '100% (40/40)', trainingType: 'srp_limp_blind', maxBest: 40 },
  { id: 'shark_flop_3bp_4bp_5bp_non_blind', tier: 'shark', name: 'ポストフロップ 中級 3BP/4BP Blind以外 100%', desc: '100% (40/40)', trainingType: '3bp_4bp_5bp_non_blind', maxBest: 40 },
  { id: 'shark_flop_3bp_4bp_5bp_blind',     tier: 'shark', name: 'ポストフロップ 中級 3BP/4BP/5BP Blind 100%', desc: '100% (40/40)', trainingType: '3bp_4bp_5bp_blind', maxBest: 40 },
  { id: 'shark_flop_donk_bmcb',             tier: 'shark', name: 'ポストフロップ 中級 ドンク/BMCB 100%',       desc: '100% (40/40)', trainingType: 'donk_bmcb', maxBest: 40 },
];

export function tierById(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function achievementsByTier(tier: TierId): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.tier === tier);
}
