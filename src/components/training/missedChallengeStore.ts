// 挑戦モードの結果を Play → Result 画面に渡すための sessionStorage 経由ストア。
// DB には書き込まない (training_results / problem_attempts / missed_problems 更新なし)。

import type { MissedLevelQuery } from '../../api/missedProblems';
import { missedTierByKey } from '../../data/training/missedTiers';

/** 挑戦モードの level (per-level 互換 + 階級 tier)。 */
export type MissedReviewLevel = MissedLevelQuery;

const PER_LEVEL_LABEL: Record<string, string> = {
  beginner: '初級',
  intermediate: '中級 総合',
  ep: '中級 EP',
  lp: '中級 LP',
  blind: '中級 Blind',
};

/** level/tier → 表示ラベル (例: "初級" / "中級 総合")。未知は空文字。 */
export function missedReviewLabel(level: string): string {
  const tier = missedTierByKey(level);
  if (tier) return tier.label;
  return PER_LEVEL_LABEL[level] ?? '';
}

/** 間違えた問題の判定フィルター。 */
export type MissedFilter = 'all' | 'partial' | 'zero' | 'miss';

const FILTERS: ReadonlyArray<MissedFilter> = ['all', 'partial', 'zero', 'miss'];

export function parseMissedFilter(raw: string | null | undefined): MissedFilter {
  return raw && (FILTERS as ReadonlyArray<string>).includes(raw) ? (raw as MissedFilter) : 'all';
}

/** score_obtained が指定フィルターに一致するか (all は常に true)。 */
export function scoreMatchesFilter(score: number, filter: MissedFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'partial':
      return score === 1; // ○
    case 'zero':
      return score === 0; // △
    case 'miss':
      return score <= -1; // ✕
  }
}

export interface MissedChallengeItem {
  /** missed_problems.id (結果画面の「消去」ボタンで使う)。 */
  missed_problem_id: number;
  hand: string;
  scenario_label: string;
  /** 採点後スコア: 初級 = 1 / -1、 中級 = -1 / 0 / 1 / 2。 */
  final_score: number;
  /** 満点 (◎) か。 初級は final_score === 1、 中級は final_score === 2。 */
  is_perfect: boolean;
}

export interface MissedChallengeResult {
  level: MissedReviewLevel;
  total: number;
  /** 満点 (◎) 数 = 正解数。 */
  perfect_count: number;
  items: MissedChallengeItem[];
}

const STORAGE_KEY = 'missed_challenge_result';

export function saveChallengeResult(result: MissedChallengeResult): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  } catch {
    /* quota / SecurityError 等は無視 */
  }
}

export function loadChallengeResult(): MissedChallengeResult | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MissedChallengeResult;
  } catch {
    return null;
  }
}

export function clearChallengeResult(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
