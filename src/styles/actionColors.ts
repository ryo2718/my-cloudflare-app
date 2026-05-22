// アクション色の単一定義 (single source of truth)。
// ポップアップ / 即時フィードバックバー / 13×13グリッドのセル塗り / 選択肢ボタンの濃枠 が
// すべてここを参照する。確定配色 (A系統) を正とする。
//   - check は call と同じ緑、limp も緑系 (受け身に進むアクションは同色)。
// 用途別の見せ方 (ベタ塗り / 薄地+濃枠) は各コンポーネント側の責務。ここは「色の値」のみ。
//
// 注: スート色 (PlayingCard) や戦略タブの FIXED_ACTIONS (normalize.ts) は別概念のため対象外。

export const ACTION_COLOR: Record<string, string> = {
  allin: '#534AB7',
  raise: '#D8443C',
  call: '#3B8A1E',
  check: '#3B8A1E', // = call (緑)
  limp: '#3B8A1E', // = call (緑系)
  fold: '#2F7BC4',
};
