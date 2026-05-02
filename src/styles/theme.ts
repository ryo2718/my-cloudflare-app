/**
 * Centralized color tokens for the app.
 *
 * Theme: **Beige & Cream (light)** — long-session-friendly warm palette.
 * Surfaces sit around #faf6f0 / #fefdf9 with brown text (#3d2f1f) so that
 * action-colored cells (blue/green/orange/red/purple) and tier badges still
 * pop without harsh contrast.
 *
 * Action colors themselves are NOT defined here — they live in
 * src/utils/normalize.ts (FIXED_ACTIONS) so the data layer stays the single
 * source of truth for what each action looks like.
 *
 * NOTE: when changing `bg`, also update `body { background }` in src/index.css.
 */
export const THEME = {
  // Surfaces — beige & cream
  bg: '#faf6f0',                  // メインBG (ベージュクリーム)
  card: '#fefdf9',                // カード背景 (ほぼ白、わずかに暖色)
  cardElevated: '#f5efe5',        // 強調カード背景 (やや濃い)
  border: '#d6cfc1',              // メインボーダー
  borderStrong: '#b8a888',        // 強調ボーダー (フォーカス・選択時)
  cellEmpty: '#ede5d4',           // 空セル (card より一段濃いベージュで識別)

  // Text — 茶系
  textPrimary: '#3d2f1f',         // メインテキスト (暗い茶)
  textSecondary: '#6b5a48',       // セカンダリ (中間茶)
  textMuted: '#8c7d6a',           // マッシュ (薄茶)
  textFaint: '#b0a18e',           // 最も薄い (フッター等)

  // Accents — アンバー/ブラウンオレンジ
  accent: '#b45309',              // アクセント (リンク・主要強調)
  accentHover: '#92400e',         // ホバー時の濃いオレンジ
  accentBg: '#b45309',            // (legacy: 現状未使用、互換用に残す)
  accentBorder: '#92400e',        // (legacy: 同上)

  // Status — light-theme error
  errorBg: '#fef2f2',             // 薄ピンク
  errorBorder: '#ef4444',         // 鮮やか赤 (raise色と統一)
  errorText: '#b91c1c',           // 濃い赤 (cream 上で読めるように)
} as const;

export type Theme = typeof THEME;
