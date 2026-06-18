// preflopV2 専用の非アクションUI色 (disabled グレー / フォーカス枠 / マトリクス枠)。
// アクション色は src/styles/actionColors.ts が単一定義。これらは「アクション色」ではない
// UI 状態色のため別管理。並行作業 (Eq) との競合回避で共通基盤 theme.ts には足さず、
// ここで一元定義して各コンポーネントは import で参照する (色のハードコード禁止に準拠)。
export const PREFLOP_UI = {
  disabledBg: '#B4B2A9', // データ無しでグレーアウト
  disabledText: '#5F5E5A',
  focusBorder: '#842821', // (legacy, 現状未使用)
  matrixFrame: '#000000', // ハンドマトリクスの囲み枠
} as const;

// ハンドマトリクスのセル色 = 旧 2.5x モバイル (画像1) の薄色パレット。
// git 96e789d^:src/components/mobile/MobileHandMatrix.tsx の MOBILE_COLOR_MAP より復元。
// アクションボタン/集計 (actionColors の濃色) とは別概念のためここで管理。
export const MATRIX_CELL_COLOR = {
  fold: '#60a5fa',
  call: '#4ade80',
  raise: '#f87171',
  allin: '#c084fc',
} as const;
