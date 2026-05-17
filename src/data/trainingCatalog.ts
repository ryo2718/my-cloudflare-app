// トレーニング種別のカタログ定義。
// QuizPage (メニュー表示) と AccountPage (成績一覧) で共用する。
//
// 将来のスキーマ:
//   - DB: training_results.training_type に key を保存
//   - 各 level の points / timeLimitSec は Phase F 以降で実装時に参照

export interface TrainingLevel {
  /** DB の training_type 値、SavedTraining と join するキー。 */
  key: string;
  /** UI 表示名。 */
  label: string;
  /** ポイント (実装済 level のみ提示)。 */
  points: number | null;
  /** 制限時間秒。null = 制限なし。未実装 level は undefined。 */
  timeLimitSec: number | 'none' | null;
  /** 実装済か。false なら「未実装」表示。 */
  implemented: boolean;
}

export interface TrainingCategory {
  /** カテゴリキー (UI 識別用)。 */
  key: 'preflop' | 'flop';
  label: string;
  levels: TrainingLevel[];
}

export const TRAINING_CATALOG: ReadonlyArray<TrainingCategory> = [
  {
    key: 'preflop',
    label: 'プリフロップトレーニング',
    levels: [
      { key: 'preflop_beginner',     label: '初級',   points: 1,    timeLimitSec: 'none', implemented: false },
      { key: 'preflop_intermediate', label: '中級',   points: 3,    timeLimitSec: 20,     implemented: false },
      { key: 'preflop_advanced',     label: '上級',   points: null, timeLimitSec: null,   implemented: false },
      { key: 'preflop_expert',       label: '超上級', points: null, timeLimitSec: null,   implemented: false },
    ],
  },
  {
    key: 'flop',
    label: 'フロップトレーニング',
    levels: [
      { key: 'flop_beginner',     label: '初級',   points: null, timeLimitSec: null, implemented: false },
      { key: 'flop_intermediate', label: '中級',   points: null, timeLimitSec: null, implemented: false },
      { key: 'flop_advanced',     label: '上級',   points: null, timeLimitSec: null, implemented: false },
      { key: 'flop_expert',       label: '超上級', points: null, timeLimitSec: null, implemented: false },
    ],
  },
];

/**
 * AccountPage 成績一覧で表示する 4 種固定カテゴリ。
 * 「プリフロップ初級」「プリフロップ中級」「フロップ初級」「フロップ中級」を
 * training_type と人間可読 label のペアで返す。
 */
export const TRAINING_RESULT_DISPLAY: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'preflop_beginner',     label: 'プリフロップ初級' },
  { key: 'preflop_intermediate', label: 'プリフロップ中級' },
  { key: 'flop_beginner',        label: 'フロップ初級' },
  { key: 'flop_intermediate',    label: 'フロップ中級' },
];
