// トレーニングレベルのアンロック判定 (純粋関数)。
//
// アンロックルール:
//   - 初級 (preflop_beginner): 常にアンロック
//   - 中級 (preflop_intermediate): 初級 best_score >= 20 (= 全問正解)
//   - 上級 (preflop_advanced): 中級 best_score >= 20 (= 40 点満点中 50%)
//   - 超上級 (preflop_expert): 上級が未実装のため常にロック
//
// API レスポンス (apiAccountTrainingResults) の TrainingResult[] を入力に、
// QuizPage の各 LevelAccordion でロック状態を判定する。

import type { TrainingResult } from '../../api/account';

/** 中級アンロックに必要な初級ベストスコア。 */
export const INTERMEDIATE_UNLOCK_THRESHOLD = 20;
/** 上級アンロックに必要な中級ベストスコア (40 点満点の 50%)。 */
export const ADVANCED_UNLOCK_THRESHOLD = 20;
/** フロップ初級アンロックに必要なプリフロップ初級ベストスコア (= 20/20 クリア)。 */
export const FLOP_BEGINNER_UNLOCK_THRESHOLD = 20;
/** フロップ中級アンロックに必要なフロップ初級ベストスコア (= 20/20 クリア)。 */
export const FLOP_INTERMEDIATE_UNLOCK_THRESHOLD = 20;

export interface UnlockStatus {
  beginnerUnlocked: boolean;        // 常に true
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
  return {
    beginnerUnlocked: true,
    intermediateUnlocked: bestOf('preflop_beginner') >= INTERMEDIATE_UNLOCK_THRESHOLD,
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
    // フロップ中級 (レンジベット / 個別ハンドCB): フロップ初級クリアで解放。
    case 'flop_intermediate':
    case 'flop_intermediate_cb':
      return status.flopIntermediateUnlocked;
    // 他の flop (上級〜超上級) は未実装 / ロック扱い
    default:
      return false;
  }
}

/** ロック中のレベルにユーザーへ表示するヒント文。 */
export function lockHintFor(levelKey: string): string | null {
  switch (levelKey) {
    case 'preflop_intermediate':
    case 'preflop_intermediate_ep':
    case 'preflop_intermediate_lp':
    case 'preflop_intermediate_blind':
      return `初級で ${INTERMEDIATE_UNLOCK_THRESHOLD}/20 取るとアンロック`;
    case 'preflop_advanced':
      return `中級で ${ADVANCED_UNLOCK_THRESHOLD}pt 取るとアンロック`;
    case 'preflop_expert':
      return '未実装';
    case 'flop_beginner':
      return `プリフロップ初級で ${FLOP_BEGINNER_UNLOCK_THRESHOLD}/20 取るとアンロック`;
    case 'flop_intermediate':
    case 'flop_intermediate_cb':
      return `フロップ初級で ${FLOP_INTERMEDIATE_UNLOCK_THRESHOLD}/20 取るとアンロック`;
    default:
      return null;
  }
}
