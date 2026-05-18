// D1 row 型 + API レスポンス型。
//
// 注: D1 の boolean は INTEGER (0/1) で来るため、accounts.is_admin は number 型。
// クライアントへ返す時は boolean に変換する (AccountResponse 経由)。

export interface AccountRow {
  id: number;
  poker_name: string;
  private_pass: string;
  is_admin: number; // 0 or 1
  created_at: number;
  last_login_at: number | null;
  /** migration 0003 で追加。 */
  points: number;
  /** migration 0008 で追加。 ranking から除外 (参考枠表示) + 成績リセット権限。 */
  is_ranking_excluded: number; // 0 or 1
}

export interface TrainingResultRow {
  id: number;
  account_id: number;
  training_type: string;
  /** 20 問中の最高正解数。 */
  best_score: number;
  best_score_at: number;
  total_attempts: number;
  updated_at: number;
}

export interface AccountDetail {
  poker_name: string;
  points: number;
  training_results: TrainingResultRow[];
}

export interface SessionRow {
  id: string;
  account_id: number;
  created_at: number;
  expires_at: number;
}

/** missed_problems テーブル 1 行。 */
export interface MissedProblemRow {
  id: number;
  account_id: number;
  training_type: string;
  scenario_type: string;
  hero_position: string;
  opener_position: string | null;
  three_bettor_position: string | null;
  hand: string;
  /** JSON: ('allin' | 'raise' | 'call' | 'fold')[] (中級) or ('participate' | 'fold')[] (初級) */
  user_selections: string;
  /** JSON: { allin, raise, call, fold } (0-100) */
  gto_strategy: string;
  score_obtained: number;
  is_timeout: number;
  is_removed_from_review: number;
  created_at: number;
}

export interface GroupKeyRow {
  id: number;
  key_value: string;
  active_from: number;
  active_until: number | null;
  created_at: number;
}

/** クライアント (フロント) に返す account の最小情報 (private_pass は含めない)。 */
export interface AccountPublic {
  id: number;
  poker_name: string;
  is_admin: boolean;
  is_ranking_excluded: boolean;
}

/** Admin 画面用 (平文 private_pass + last_login_at + total_points を含む)。 */
export interface AccountAdmin {
  id: number;
  poker_name: string;
  private_pass: string;
  is_admin: boolean;
  created_at: number;
  last_login_at: number | null;
  /** training_results.best_score の合計 (LEFT JOIN + SUM)。未挑戦は 0。 */
  total_points: number;
}

export interface AuthSuccess {
  session_id: string;
  account: AccountPublic;
}

export interface Env {
  DB: D1Database;
}

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 日
