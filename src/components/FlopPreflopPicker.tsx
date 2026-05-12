// Phase R1 scaffolding — 中身は Phase R2 で実装。
//
// 元要件 §3: Preflop シナリオ選択 (1 つ)
//   ○limp ○srp ○2bp ○3bp ○4bp ○5bp
//   存在しない組合せは disabled (グレー、クリック不可)。
//
// 6 buckets 全部表示。Q1 確定: `2bp` = limp+iso family (SB-only)、`srp` は標準ツリーのみ。
// findFlopVariants(opener, responder, depth, action) で存在判定。

export type PreflopBucket = 'limp' | 'srp' | '2bp' | '3bp' | '4bp' | '5bp';

export interface FlopPreflopPickerProps {
  bucket: PreflopBucket | null;
  /** 2 ポジション (auto opener/responder 判定材料)。null/length<2 なら全部 disabled。 */
  positions: ReadonlyArray<string>;
  onChange: (bucket: PreflopBucket) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function FlopPreflopPicker({ bucket: _bucket, positions: _positions, onChange: _onChange }: FlopPreflopPickerProps) {
  return null; // TODO Phase R2: 6 ボタン + disable 判定
}
