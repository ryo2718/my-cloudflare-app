// トレーニング種別のカタログ。
// QuizPage (メニュー) / AccountPage (成績) で共有。
//
// 表示仕様:
//   - label のみ表示 ("初級"/"中級"/"上級"/"超上級")
//   - points × questionCount から最大 pt を計算
//   - timeLimitSec: "なし" / "20s" 表記
//   - implemented=false の場合は「未実装」バッジ + 挑戦不可

export interface TrainingLevel {
  /** DB の training_type 値。 */
  key: string;
  /** "初級" 等の難易度。 */
  label: string;
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
      { key: 'preflop_beginner',     label: '初級',   points: 1,    questionCount: 20,   timeLimitSec: 'none', implemented: true  },
      // 中級は best_score が finalSum (0-40) を直接表す pt 値。 points=1 で累計と整合。
      { key: 'preflop_intermediate', label: '中級',   points: 1,    questionCount: 20,   timeLimitSec: 20,     implemented: true  },
      { key: 'preflop_advanced',     label: '上級',   points: null, questionCount: null, timeLimitSec: null,   implemented: false },
      { key: 'preflop_expert',       label: '超上級', points: null, questionCount: null, timeLimitSec: null,   implemented: false },
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
  // 中級 (preflop_intermediate) は満点 40pt 表記 (1問 -1〜+2pt の合計)。
  if (level.key === 'preflop_intermediate') {
    const max = (level.questionCount ?? 20) * 2;
    return `20問・最大 ${max}pt・制限時間 20s`;
  }
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

/**
 * 各 level の満点 (best_score の最大値)。
 *  - 初級: questionCount (= 20, 正解数そのまま)
 *  - 中級: questionCount * 2 (= 40, 1問最大 2pt の合計)
 *  - 未計画 (questionCount=null) は 0
 */
export function maxScoreFor(level: TrainingLevel): number {
  if (level.questionCount === null) return 0;
  if (level.key === 'preflop_intermediate') return level.questionCount * 2;
  return level.questionCount;
}

/** N/MAX 点 → "75%" / "67.5%" 形式の達成率表記 (整数のとき小数なし)。 */
export function formatScorePct(score: number, max: number): string {
  if (max <= 0) return '—';
  const pct = (score / max) * 100;
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/** Routing 用: level key → confirm/play/result/rules path */
export function trainingPath(key: string, screen: 'confirm' | 'play' | 'result' | 'rules'): string {
  // 'preflop_beginner' → '/training/preflop-beginner/confirm'
  const slug = key.replace(/_/g, '-');
  return `/training/${slug}/${screen}`;
}

/** 振り返り画面のパス。 index は 1-indexed (= 間違えた問題内での位置)。 */
export function trainingReviewPath(key: string, index: number): string {
  const slug = key.replace(/_/g, '-');
  return `/training/${slug}/review/${index}`;
}
