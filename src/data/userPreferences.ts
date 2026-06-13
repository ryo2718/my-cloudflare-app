// ユーザー設定の永続化 (localStorage)。既存の savedAccounts / useViewportMode と同じ方式。
// 現状は「即時フィードバック」トグルのみ。

const STORAGE_KEY = 'pokergto.user_preferences';

/** 正答率の表示カテゴリ (プリフロップ / ポストフロップ)。 */
export type StatsCategory = 'preflop' | 'flop';

export interface UserPreferences {
  /** トレーニングの即時フィードバック (回答直後に答えを表示) ON/OFF。既定 OFF。 */
  instantFeedback: boolean;
  /** アカウント画面の正答率トグル (前回選択を保存)。既定 'preflop'。 */
  statsCategory: StatsCategory;
}

const DEFAULTS: UserPreferences = { instantFeedback: false, statsCategory: 'preflop' };

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      instantFeedback: typeof p.instantFeedback === 'boolean' ? p.instantFeedback : DEFAULTS.instantFeedback,
      statsCategory: p.statsCategory === 'flop' ? 'flop' : DEFAULTS.statsCategory,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* QuotaExceeded / SecurityError 等は silent */
  }
}

export function loadInstantFeedback(): boolean {
  return loadUserPreferences().instantFeedback;
}

export function saveInstantFeedback(on: boolean): void {
  saveUserPreferences({ ...loadUserPreferences(), instantFeedback: on });
}

export function loadStatsCategory(): StatsCategory {
  return loadUserPreferences().statsCategory;
}

export function saveStatsCategory(c: StatsCategory): void {
  saveUserPreferences({ ...loadUserPreferences(), statsCategory: c });
}
