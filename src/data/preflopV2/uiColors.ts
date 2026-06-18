// preflopV2 専用の非アクションUI色 (disabled グレー / フォーカス枠 / マトリクス枠)。
// アクション色は src/styles/actionColors.ts が単一定義。これらは「アクション色」ではない
// UI 状態色のため別管理。並行作業 (Eq) との競合回避で共通基盤 theme.ts には足さず、
// ここで一元定義して各コンポーネントは import で参照する (色のハードコード禁止に準拠)。
export const PREFLOP_UI = {
  disabledBg: '#B4B2A9', // call などデータ無しでグレーアウト
  disabledText: '#5F5E5A',
  focusBorder: '#842821', // 現在の actor 列を囲む枠
  matrixFrame: '#000000', // ハンドマトリクスの囲み枠
} as const;
