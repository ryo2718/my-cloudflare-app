// トレーニングレベルのアンロック判定 (純粋関数)。
//
// アンロックルール:
//   - 初級 (preflop_beginner): 常にアンロック
//   - 中級 (preflop_intermediate): プリフロップ初級 4 モードを全部クリア
//       (基礎 100%/20, オープン・vsオープン・vs3bet4bet 各 90%/18 = CLEAR_THRESHOLDS)
//   - 上級 (preflop_advanced): 中級 best_score >= 20 (= 40 点満点中 50%)
//   - 超上級 (preflop_expert): 上級が未実装のため常にロック
//
// API レスポンス (apiAccountTrainingResults) の TrainingResult[] を入力に、
// QuizPage の各 LevelAccordion でロック状態を判定する。

import type { TrainingResult } from '../../api/account';
import { isCleared } from '../clearThresholds';

/** 中級アンロックに必要な初級ベストスコア。 */
export const INTERMEDIATE_UNLOCK_THRESHOLD = 20;
/** 上級アンロックに必要な中級ベストスコア (40 点満点の 50%)。 */
export const ADVANCED_UNLOCK_THRESHOLD = 20;
/** フロップ初級アンロックに必要なプリフロップ初級ベストスコア (= 20/20 クリア)。 */
export const FLOP_BEGINNER_UNLOCK_THRESHOLD = 20;
/** フロップ中級アンロックに必要なフロップ初級ベストスコア (= 18/20 = 90% クリア)。 */
export const FLOP_INTERMEDIATE_UNLOCK_THRESHOLD = 18;

export interface UnlockStatus {
  beginnerUnlocked: boolean;        // 常に true
  beginnerOpenUnlocked: boolean;    // 初級基礎クリア(満点)で解放
  beginnerVsOpenUnlocked: boolean;  // 初級基礎クリア(満点)で解放
  beginnerVs3Bet4BetUnlocked: boolean; // 初級基礎クリア(満点)で解放
  intermediateUnlocked: boolean;
  advancedUnlocked: boolean;
  superAdvancedUnlocked: boolean;   // 常に false (未実装)
  flopBeginnerUnlocked: boolean;    // プリフロップ初級クリアで解放
  flopIntermediateUnlocked: boolean; // フロップ初級クリアで解放 (CB/Donk/BMCB 枠)
}

/** training_results 配列からアンロック状態を計算 (純粋関数)。 */
export function computeUnlockStatus(records: ReadonlyArray<TrainingResult>): UnlockStatus {
  const bestOf = (type: string): number => {
    const r = records.find((x) => x.training_type === type);
    return r?.best_score ?? 0;
  };
  // 中級は「プリフロップ初級 4 モードを全部クリア」で解放。
  const allBeginnerCleared =
    isCleared('preflop_beginner', bestOf('preflop_beginner')) &&
    isCleared('preflop_beginner_open', bestOf('preflop_beginner_open')) &&
    isCleared('preflop_beginner_vs_open', bestOf('preflop_beginner_vs_open')) &&
    isCleared('preflop_beginner_vs_3bet_4bet', bestOf('preflop_beginner_vs_3bet_4bet'));
  return {
    beginnerUnlocked: true,
    beginnerOpenUnlocked: bestOf('preflop_beginner') >= INTERMEDIATE_UNLOCK_THRESHOLD,
    beginnerVsOpenUnlocked: bestOf('preflop_beginner') >= INTERMEDIATE_UNLOCK_THRESHOLD,
    beginnerVs3Bet4BetUnlocked: bestOf('preflop_beginner') >= INTERMEDIATE_UNLOCK_THRESHOLD,
    intermediateUnlocked: allBeginnerCleared,
    advancedUnlocked: bestOf('preflop_intermediate') >= ADVANCED_UNLOCK_THRESHOLD,
    superAdvancedUnlocked: false,
    flopBeginnerUnlocked: bestOf('preflop_beginner') >= FLOP_BEGINNER_UNLOCK_THRESHOLD,
    flopIntermediateUnlocked: bestOf('flop_beginner') >= FLOP_INTERMEDIATE_UNLOCK_THRESHOLD,
  };
}

/** level.key から UnlockStatus の対応プロパティを取得。未対応 key は false。 */
export function isLevelUnlocked(levelKey: string, status: UnlockStatus): boolean {
  switch (levelKey) {
    case 'preflop_beginner':
      return status.beginnerUnlocked;
    case 'preflop_beginner_open':
      return status.beginnerOpenUnlocked;
    case 'preflop_beginner_vs_open':
      return status.beginnerVsOpenUnlocked;
    case 'preflop_beginner_vs_3bet_4bet':
      return status.beginnerVs3Bet4BetUnlocked;
    // 中級ポジション別 (EP/LP/Blind) は中級総合と同じタイミングで解放 (初級 100%)。
    case 'preflop_intermediate':
    case 'preflop_intermediate_ep':
    case 'preflop_intermediate_lp':
    case 'preflop_intermediate_blind':
      return status.intermediateUnlocked;
    case 'preflop_advanced':
      return status.advancedUnlocked;
    case 'preflop_expert':
      return status.superAdvancedUnlocked;
    // フロップ初級: プリフロップ初級クリアで解放。
    case 'flop_beginner':
      return status.flopBeginnerUnlocked;
    // フロップ中級 (CB SRP/3BP4BP5BP / ドンクBMCB / 旧個別ハンドCB): フロップ初級クリアで解放。
    case 'flop_intermediate':
    case 'flop_intermediate_cb':
    case 'flop_cb_srp':
    case 'flop_cb_3bp':
    case 'flop_donk_bmcb':
      return status.flopIntermediateUnlocked;
    // 他の flop (上級〜超上級) は未実装 / ロック扱い
    default:
      return false;
  }
}

/** ロック中のレベルにユーザーへ表示するヒント文。 */
export function lockHintFor(levelKey: string): string | null {
  switch (levelKey) {
    case 'preflop_beginner_open':
    case 'preflop_beginner_vs_open':
    case 'preflop_beginner_vs_3bet_4bet':
      return 'プリフロップ初級 基礎をクリアするとアンロック';
    case 'preflop_intermediate':
    case 'preflop_intermediate_ep':
    case 'preflop_intermediate_lp':
    case 'preflop_intermediate_blind':
      return 'プリフロップ初級を全部クリアするとアンロック';
    case 'preflop_advanced':
      return `プリフロップ中級で ${ADVANCED_UNLOCK_THRESHOLD}pt 取るとアンロック`;
    case 'preflop_expert':
      return '未実装';
    case 'flop_beginner':
      return 'プリフロップ初級 基礎をクリアするとアンロック';
    case 'flop_intermediate':
    case 'flop_intermediate_cb':
    case 'flop_cb_srp':
    case 'flop_cb_3bp':
    case 'flop_donk_bmcb':
      return 'ポストフロップ初級をクリアするとアンロック';
    default:
      return null;
  }
}
