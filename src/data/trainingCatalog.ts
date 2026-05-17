// トレーニング種別のカタログ定義。
// QuizPage (メニュー表示) と AccountPage (成績一覧) で共用。
//
// 設計:
//   - points !== null かつ implemented=false → "実装予定だが未実装" (Account では "--- /20 (未挑戦)" 風)
//   - points === null → "範囲外、未実装" (Account では "未実装")

export interface TrainingLevel {
  /** DB の training_type 値。 */
  key: string;
  /** "初級" 等の難易度。 */
  label: string;
  /** "オープンレンジ" 等の括弧内補足。 */
  subtitle?: string;
  /** ポイント (null = 未計画)。 */
  points: number | null;
  /** 出題数。null = 未計画。 */
  questionCount: number | null;
  /** 制限時間秒。'none' = 制限なし、null = 未計画。 */
  timeLimitSec: number | 'none' | null;
  /** 既に問題セットが組まれているか。false なら「未実装」表示。 */
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
      { key: 'preflop_beginner',     label: '初級',   subtitle: 'オープンレンジ', points: 1,    questionCount: 20, timeLimitSec: 'none', implemented: false },
      { key: 'preflop_intermediate', label: '中級',   subtitle: 'vs open',        points: 3,    questionCount: 20, timeLimitSec: 20,     implemented: false },
      { key: 'preflop_advanced',     label: '上級',   subtitle: '3bet',           points: null, questionCount: null, timeLimitSec: null, implemented: false },
      { key: 'preflop_expert',       label: '超上級', subtitle: '4bet+',          points: null, questionCount: null, timeLimitSec: null, implemented: false },
    ],
  },
  {
    key: 'flop',
    label: 'フロップトレーニング',
    levels: [
      { key: 'flop_beginner',     label: '初級',   points: null, questionCount: null, timeLimitSec: null, implemented: false },
      { key: 'flop_intermediate', label: '中級',   points: null, questionCount: null, timeLimitSec: null, implemented: false },
      { key: 'flop_advanced',     label: '上級',   points: null, questionCount: null, timeLimitSec: null, implemented: false },
      { key: 'flop_expert',       label: '超上級', points: null, questionCount: null, timeLimitSec: null, implemented: false },
    ],
  },
];

/** 「実装予定」(points !== null) かつ未実装 → 成績画面では "--- /20 (未挑戦)" 表示。 */
export function isPlanned(level: TrainingLevel): boolean {
  return level.points !== null;
}
