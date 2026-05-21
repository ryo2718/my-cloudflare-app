// ユーザー設定の永続化 (localStorage)。既存の savedAccounts / useViewportMode と同じ方式。
// 現状は「即時フィードバック」トグルのみ。

const STORAGE_KEY = 'pokergto.user_preferences';

export interface UserPreferences {
  /** トレーニングの即時フィードバック (回答直後に答えを表示) ON/OFF。既定 OFF。 */
  instantFeedback: boolean;
}

const DEFAULTS: UserPreferences = { instantFeedback: false };

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<UserPreferences>;
    return { instantFeedback: typeof p.instantFeedback === 'boolean' ? p.instantFeedback : DEFAULTS.instantFeedback };
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
