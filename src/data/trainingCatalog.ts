// トレーニング種別のカタログ。
// QuizPage (メニュー) / AccountPage (成績) / Confirm 画面で共有。
//
// 表示仕様 (ユーザ指定):
//   - subtitle: ("オープンレンジ" 等) 括弧書きで難易度の説明を補足
//   - points × questionCount: "1pt × 20問" の形で 1 回挑戦の最大スコア
//   - timeLimitSec: "なし" / "20s" 表記
//   - implemented=false の場合は「未実装」バッジ + 挑戦不可

export interface TrainingLevel {
  /** DB の training_type 値。 */
  key: string;
  /** "初級" 等の難易度。 */
  label: string;
  /** 括弧内の補足 (オープンレンジ / vs open / 3bet / 4bet+ 等)。 */
  subtitle?: string;
  /** 1 問あたりの獲得ポイント (= ベストスコア取得時の 1 問あたり pt 上限)。null = 未計画。 */
  points: number | null;
  /** 出題数。null = 未計画。 */
  questionCount: number | null;
  /** 制限時間秒。'none' = 制限なし、null = 未計画。 */
  timeLimitSec: number | 'none' | null;
  /** 実装済みか。false なら QuizPage で「未実装」バッジ表示 + 挑戦不可。 */
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
      { key: 'preflop_beginner',     label: '初級',   subtitle: 'オープンレンジ', points: 1,    questionCount: 20,   timeLimitSec: 'none', implemented: true  },
      { key: 'preflop_intermediate', label: '中級',   subtitle: 'vs open',        points: 3,    questionCount: 20,   timeLimitSec: 20,     implemented: true  },
      { key: 'preflop_advanced',     label: '上級',   subtitle: '3bet',           points: null, questionCount: null, timeLimitSec: null,   implemented: false },
      { key: 'preflop_expert',       label: '超上級', subtitle: '4bet+',          points: null, questionCount: null, timeLimitSec: null,   implemented: false },
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

/** 実装済 (挑戦可能) かどうか。 */
export function isPlayable(level: TrainingLevel): boolean {
  return level.implemented && level.points !== null && level.questionCount !== null;
}

/** 実装予定 (Account 画面の「--- /20 (未挑戦)」表示用)。 */
export function isPlanned(level: TrainingLevel): boolean {
  return level.questionCount !== null;
}

/** "1pt × 20問・制限時間なし" 形式の補助情報。 */
export function formatLevelInfo(level: TrainingLevel): string {
  const parts: string[] = [];
  if (level.points !== null) parts.push(`${level.points}pt`);
  if (level.questionCount !== null) parts.push(`${level.questionCount}問`);
  const ptCount = parts.join(' × ');
  const time =
    level.timeLimitSec === 'none'
      ? '制限時間なし'
      : typeof level.timeLimitSec === 'number'
        ? `制限時間 ${level.timeLimitSec}s`
        : '';
  return [ptCount, time].filter(Boolean).join('・');
}

/** Routing 用: level key → confirm path */
export function trainingPath(key: string, screen: 'confirm' | 'play' | 'result'): string {
  // 'preflop_beginner' → '/training/preflop-beginner/confirm'
  const slug = key.replace(/_/g, '-');
  return `/training/${slug}/${screen}`;
}

/** 振り返り画面のパス。 index は 1-indexed (= 間違えた問題内での位置)。 */
export function trainingReviewPath(key: string, index: number): string {
  const slug = key.replace(/_/g, '-');
  return `/training/${slug}/review/${index}`;
}
