// プリフロップトレーニングの「クリア」定義 (実績判定 + 表示で参照)。
//
// 初級: 100% (20/20)
// 中級:  80% (32/40)
// 上級:  70% (28/40)  ※ 未実装、 判定だけ用意
// 超上級: 60% (24/40) ※ 未実装、 判定だけ用意
//
// ※ 将来「単語トレーニング」など別カテゴリが追加される予定。 実績文言では
//   「プリフロップ◯◯」と明示する (将来カテゴリ追加時に区別できるよう)。

export interface ClearThreshold {
  maxScore: number;
  clearPercent: number;
  clearScore: number;
  implemented: boolean;
}

export const CLEAR_THRESHOLDS: Record<string, ClearThreshold> = {
  preflop_beginner:           { maxScore: 20, clearPercent: 100, clearScore: 20, implemented: true },
  preflop_intermediate:       { maxScore: 40, clearPercent:  80, clearScore: 32, implemented: true },
  // 中級ポジション別 (EP/LP/Blind): クリア基準 80%。
  preflop_intermediate_ep:    { maxScore: 20, clearPercent:  80, clearScore: 16, implemented: true },
  preflop_intermediate_lp:    { maxScore: 20, clearPercent:  80, clearScore: 16, implemented: true },
  preflop_intermediate_blind: { maxScore: 30, clearPercent:  80, clearScore: 24, implemented: true },
  preflop_advanced:           { maxScore: 40, clearPercent:  70, clearScore: 28, implemented: false },
  preflop_super_advanced:     { maxScore: 40, clearPercent:  60, clearScore: 24, implemented: false },
};

export function isCleared(trainingType: string, bestScore: number): boolean {
  const t = CLEAR_THRESHOLDS[trainingType];
  if (!t) return false;
  return bestScore >= t.clearScore;
}
