// トレーニング種別のカタログ定義。
//
// 設計:
//   - questionCount !== null かつ implemented=false → 実装予定だが未実装
//     (Account では "--- /20 (未挑戦)" 表示)
//   - questionCount === null → 範囲外、未実装 (Account でも "未実装" 表示)
//
// 注意: 各レベルの「サブタイトル」「ポイント数」「制限時間」等は仕様未確定のため
//       カタログに持たない。実装が決まり次第追加する。

export interface TrainingLevel {
  /** DB の training_type 値。 */
  key: string;
  /** "初級" 等の難易度。 */
  label: string;
  /** 出題数。null = 未計画。 */
  questionCount: number | null;
  /** 既に問題セットが組まれているか。false なら「未実装」通知。 */
  implemented: boolean;
}

export interface TrainingCategory {
  key: 'preflop' | 'flop';
  label: string;
  levels: TrainingLevel[];
}

export const TRAINING_CATALOG: ReadonlyArray<TrainingCategory> = [
  {
    key: 'preflop',
    label: 'プリフロップトレーニング',
    levels: [
      { key: 'preflop_beginner',     label: '初級',   questionCount: 20,   implemented: false },
      { key: 'preflop_intermediate', label: '中級',   questionCount: 20,   implemented: false },
      { key: 'preflop_advanced',     label: '上級',   questionCount: null, implemented: false },
      { key: 'preflop_expert',       label: '超上級', questionCount: null, implemented: false },
    ],
  },
  {
    key: 'flop',
    label: 'フロップトレーニング',
    levels: [
      { key: 'flop_beginner',     label: '初級',   questionCount: null, implemented: false },
      { key: 'flop_intermediate', label: '中級',   questionCount: null, implemented: false },
      { key: 'flop_advanced',     label: '上級',   questionCount: null, implemented: false },
      { key: 'flop_expert',       label: '超上級', questionCount: null, implemented: false },
    ],
  },
];

/** 「実装予定」(問題数が決まっている) → 成績画面では "--- /20 (未挑戦)" 表示。 */
export function isPlanned(level: TrainingLevel): boolean {
  return level.questionCount !== null;
}
