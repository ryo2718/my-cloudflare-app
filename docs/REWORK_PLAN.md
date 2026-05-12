# Flop タブ UI 大改修 実装計画書 (Phase R1-R5)

> **STATUS**: **全 Phase R1-R5 完了 ✅** (2026-05-12)
> - R1: tag `legacy/phase-0-8` + branch `rework/ui-v2` + scaffolding 4 files
> - R2: §1-3 (Input / Position / Preflop) + variant 自動判定 helper + 23 件 test
> - R3: §4-5 (BoardSummary 横並び + 5列 table)
> - R4: §6-7 dual-row + tentative commit + 履歴 + 旧 IPActions stub 削除
> - R5: 旧 3 components 削除、最終確認 (lint 0 / tsc 0 / 197 tests / build 87.61 KB)
> 完了時のテスト数: 174 (Phase 0-8 基準) + 23 (R2 helpers) = **197 / 197 PASS**

## 0. 改修の前提と非目標

| 区分 | 内容 |
|---|---|
| **目標** | 元要件メッセージに記載の 7 セクション構成 UI に作り直す (OOP/IP 並列 dual-row 含む) |
| **非目標 (絶対不変)** | 既存 preflop タブの動作、データ取得層 (`useFlopNode` ほか)、データ定義 (`types/flop.ts`)、共通 util (`strategySymbol`/`SUIT_COLOR`) |
| **既存テスト** | 174 件、可能な限り全件維持。logic 層の test は変更ゼロを目標 |
| **ロールバック** | git tag `legacy/phase-0-8` で現状を凍結。改修ブランチで作業、不可時に即時復帰可 |

## 1. 背景

Phase 0-8 で実装した UI は機能的には完成しているが、元要件メッセージで指定された UI 構造と本質的に異なる:

| 観点 | 旧 (Phase 0-8) | 元要件 (本改修の目標) |
|---|---|---|
| Flop 入力 | 「フロップを指定」開閉ボタン (Q3=C 確定の result) | **常時表示**、Section 1 (画面上部) |
| Position 選択 | opener-select + responder-select 2 つの dropdown | **6 ボタンから 2 つチェック**、auto opener/caller 判定 |
| Preflop 深度 | 5 ボタン (limp/SRP/3bp/4bp/5bp)、Variant Selector 内 | **6 ボタン (limp/srp/2bp/3bp/4bp/5bp)** 独立セクション |
| アクション表示 | 1 つの「現ノードの actor のアクションリスト」 | **OOP 行 + IP 行の dual-row**、OOP→IP の sequential フロー |
| BoardSummary | OOP/IP 縦並び、Visual トグル | **OOP/IP 横並び**、大カードを中央 |
| Board 一覧 | サイドの折りたたみ | **最下部の折りたたみ** (優先度低、残存可) |

## 2. 確定 UI 構造 (7 セクション、上から順)

```
┌────────────────────────────────────────────────────────┐
│ § 1. FLOP 入力                                          │
│   [□] [□] [□]   ← 3 slot 表示                           │
│   13×4 グリッド (♠♥♦♣ 色付き)、選択済み disabled         │
│   [Reset]                                              │
├────────────────────────────────────────────────────────┤
│ § 2. Position 選択 (2 つ)                               │
│   [SB] [BB] [UTG] [HJ] [CO] [BTN]                      │
│   選択中はダーク背景 + ✓                                │
├────────────────────────────────────────────────────────┤
│ § 3. Preflop シナリオ (1 つ)                            │
│   [limp] [srp] [2bp] [3bp] [4bp] [5bp]                 │
│   非対応の組合せは disabled                             │
├────────────────────────────────────────────────────────┤
│ § 4. ボード概要 (variant 決定後に表示)                  │
│   BB (caller)            UTG (original)                │
│   OOP                    IP                            │
│   EV: +0.42              EV: +1.85                     │
│   EQR: 0.88              EQR: 1.12                     │
│                                                        │
│        [Q♠] [T♠] [7♥]    ← 大きめカード中央             │
├────────────────────────────────────────────────────────┤
│ § 5. OOP アクション一覧                                 │
│   OOP: BB                                              │
│   ┌──┬──────┬───┬──────┬─────────────┐                │
│   │◎ │check │ — │ 72%  │ [check]    │                │
│   │○ │bet   │33%│ 22%  │ [bet 33%]  │                │
│   │△ │bet   │75%│  6%  │ [bet 75%]  │                │
│   └──┴──────┴───┴──────┴─────────────┘                │
├────────────────────────────────────────────────────────┤
│ § 6. IP アクション一覧 (OOP 決定後に表示)               │
│   IP: UTG                                              │
│   初期: 「OOP の選択待ち」グレーアウト                  │
│   OOP 選択後: § 5 と同形式の table 表示                 │
├────────────────────────────────────────────────────────┤
│ § 7. アクション履歴 (Breadcrumb)                        │
│   🏠 utgr_bbc › BB check › UTG bet 33% › [Reset]       │
├────────────────────────────────────────────────────────┤
│ § (任意) Board 別解 (1,755) 折りたたみ                  │
└────────────────────────────────────────────────────────┘
```

## 3. 旧 UI ↔ 新 UI 対応表

### 3-1. UI コンポーネント

| 旧 ファイル | 改修方針 | 新ファイル名 (案) |
|---|---|---|
| `FlopStrategyView.tsx` | 全面再設計 (state machine 含む) | 同名で書き換え |
| `FlopVariantSelector.tsx` | **廃止**、機能を 2 つに分解 | `FlopPositionPicker.tsx` + `FlopPreflopPicker.tsx` (新規) |
| `FlopBoardSummary.tsx` | OOP/IP **横並び**に再設計、大カード中央 | 同名で書き換え |
| `FlopActionTotalsCard.tsx` | **廃止** (背景グラデ等は新設計では不要) | (削除) |
| `FlopNextActionButtons.tsx` | OOP 用と IP 用 2 つに分割、5 列 table 形式 | `FlopOOPActions.tsx` + `FlopIPActions.tsx` (新規) |
| `FlopBoardInput.tsx` | 常時表示に再設計 (3 slot + grid 同居) | 同名で書き換え (or `FlopCardInput.tsx`) |
| `FlopKeyboard.tsx` | 13×4 grid 専用に簡素化、3 slot は input 側 | 同名で書き換え (or `FlopCardGrid.tsx`) |
| `FlopBoardList.tsx` | **残存** (Section 7 後の折りたたみとして) | 無変更 |
| `FlopBreadcrumb.tsx` | アクション履歴に再設計 (現実装に近いが label 形式調整) | 同名で書き換え |
| `mobile/MobileFlopView.tsx` | 新 FlopStrategyView を再利用 (responsive 化が可能なら) | 無変更 (継続) |

### 3-2. 保持する layer (ゼロ修正)

| 区分 | ファイル |
|---|---|
| **データ取得** | `hooks/useFlopNode.ts` (含 `fetchFlopNode`) |
| **正準化** | `utils/flopBoardCanonical.ts`、`data/flopBoardMap.ts` |
| **chain 処理** | `data/flopChain.ts` (chainToFilename, encodeStep, hasAggressionInChain, filenameToChain) |
| **variant 判定** | `data/flopVariants.ts` (findFlopVariants, getFlopOpener, getFlopCaller, getFlopResponder, getPotDepth, getDefaultFlopVariantFromPreflopNode) |
| **manifest** | `data/flopVariantsManifest.ts` (AUTO-GENERATED) |
| **型定義** | `types/flop.ts` (Phase 1 で確定、無修正) |
| **共通 util** | `utils/strategySymbol.ts` (classifyByPlayRate, getSymbolStyle, STRATEGY_TEXT_COLORS)、`types/card.ts` (SUIT_COLOR, SUIT_SYMBOL) |
| **テーマ** | `styles/theme.ts` |
| **環境変数** | `vite-env.d.ts` |

### 3-3. App.tsx の改修

- 既存の Flop state lift (`flopVariant` / `flopChain` / `flopSelectedBoard`) は再利用
- 新規 state を追加 (positions, preflopBucket, flopCards, oopPendingAction)
- `FlopStrategyView` 呼出は同じインタフェース or 拡張

## 4. データフロー (state model + interaction)

### 4-1. state model

```ts
// App.tsx-level Flop state
interface FlopAppState {
  // § 1: ボード入力
  flopCards: Array<Card | null>;        // length 3, null 許容 (partial 状態)
  
  // § 2: Position 選択 (2 ボタン押下)
  positions: Position[];                // length 0-2、order: 押した順 (内部で再ソート)
  
  // § 3: Preflop 深度
  preflopBucket: PreflopBucket | null;  // 'limp' | 'srp' | '2bp' | '3bp' | '4bp' | '5bp'
  
  // § 4-7: variant 決定後の chain 状態
  variant: string | null;               // findFlopVariants から auto 計算
  chain: string[];                      // 確定 chain
  oopPendingAction: string | null;      // OOP がチェックしたが IP がまだ確定してない時
  
  // 任意: ボード選択 (BoardList クリック / canonical 検索)
  selectedBoardName: string | null;
}
```

### 4-2. variant 自動判定ロジック

```
positions=[X, Y] + preflopBucket=Z
  ↓ 並び替え: opener = 先順位の position, responder = 後順位
  ↓ openerAction: SB かつ Z===limp なら 'limp'、それ以外 'open'
  ↓ findFlopVariants(opener, responder, depth, action) で検索
  ↓ 0 件 → variant=null (UI disable)
  ↓ 1 件 → そのまま
  ↓ 複数 (SB-limp+iso) → smallest sort (== Phase 6 getDefault と同方針)
```

`PreflopBucket` → `PotDepth` の対応:
- `limp` → `'limp'`
- `srp` → `'SRP'`、action='open'
- `2bp` → ?? (Q1 で要確認、現状は限-iso family と仮定 → `'SRP'`、action='limp')
- `3bp` → `'3bp'`
- `4bp` → `'4bp'`
- `5bp` → `'5bp'`

### 4-3. OOP / IP の判定

データから直接取得:
```ts
const oop = data.players.find(p => p.relative_position === 'OOP');
const ip = data.players.find(p => p.relative_position === 'IP');
```
変数 `data._meta.next_actor` (小文字 'bb' 等) で現在のターン actor を判定:
```ts
const isOopTurn = oop && oop.position.toLowerCase() === data._meta.next_actor;
```

### 4-4. OOP / IP dual-action インタラクション state machine

```
[ State A: OOP turn (current node = OOP の番) ]
  - § 5 OOP 行: data.action_totals + data.game_point.available_actions
  - § 6 IP 行: 「OOP の選択待ち」(grayed out)
  - chain = chain_committed
  - oopPendingAction = null
  ↓ ユーザー OOP アクションをクリック
  
[ State B: IP turn (OOP の選択 pending、IP node fetch 済) ]
  - § 5 OOP 行: 選択した OOP アクションを highlight (取り消し可能)
  - § 6 IP 行: nextNode.action_totals + nextNode.game_point.available_actions
  - tempChain = [...chain_committed, encodeStep(oop, oopPendingAction)]
  - useFlopNode(variant, tempChain) で IP node 取得
  ↓ ユーザー IP アクションをクリック
  
[ State C: 新 round (=次の OOP turn or terminal) ]
  - chain = [...tempChain, encodeStep(ip, ipAction)]
  - oopPendingAction = null
  - useFlopNode(variant, chain) で新ノード取得
  - 新ノードの next_actor が OOP なら State A に戻る
  - terminal なら「アクション終了」表示
```

`oopPendingAction` の取消 (戻る) も実装する: OOP 行で選択中の action を再クリックすると pending 解除。

### 4-5. § 1 (FLOP 入力) の動作

```
flopCards = [null, null, null]
  ↓ grid のカードをクリック → flopCards の最初の null スロットに入る
  ↓ flopCards = [C1, null, null]
  ↓ さらにクリック → [C1, C2, null]
  ↓ 3 枚目クリック → [C1, C2, C3]
  ↓ async: getCanonicalBoardName([C1,C2,C3]) → 正準ボード名
  ↓ selectedBoardName = canonical name (該当 data あれば)
  ↓ § 4-6 が該当ボードの solution に切り替わる
[Reset] でクリア
```

選択済み (flopCards に含まれる) カードはグリッドで disabled。

## 5. Phase R1 - R5 詳細

### Phase R1: バックアップ + scaffolding (~15 分)

| 作業 | 詳細 |
|---|---|
| git tag `legacy/phase-0-8` | 現状を不変点として凍結 |
| 改修ブランチ作成 (任意) | `rework/flop-redesign` を切る or main 直接 |
| 新スケルトン作成 | `FlopPositionPicker.tsx` / `FlopPreflopPicker.tsx` / `FlopOOPActions.tsx` / `FlopIPActions.tsx` を空ファイルで生成 |
| 旧 component の使用箇所 audit | `FlopStrategyView` から旧 components の import を全部リストアップ |

**変更ファイル**: なし (準備のみ)
**テスト**: 既存 174 件はそのまま PASS 状態

### Phase R2: セクション 1-3 (Input / Position / Preflop) (~60 分)

| 作業 | 詳細 |
|---|---|
| `FlopCardInput.tsx` 新規 | 3 slot 表示 + 13×4 grid (1 component に統合)、Phase 4.3 の FlopKeyboard 流用 |
| `FlopPositionPicker.tsx` 新規 | 6 ボタン横並び、2 つまで選択可、3 つ目は最古を pop |
| `FlopPreflopPicker.tsx` 新規 | 6 ボタン横並び、existing `findFlopVariants` で disable 判定 |
| variant 自動判定 logic | `selectVariantFromUI(positions, bucket): string \| null` を新規ヘルパーとして追加 |
| **`PreflopBucket` 型追加** | `'limp' \| 'srp' \| '2bp' \| '3bp' \| '4bp' \| '5bp'` を data/flopVariants.ts に export |
| `FlopStrategyView.tsx` 改修 | 上記 3 components を mount、variant 決定までは Section 4-6 を hide |

**変更ファイル**: `FlopStrategyView.tsx`, 新規 3 files, `data/flopVariants.ts` (型/helper 追加)
**テスト**: variant 判定 helper の新規ユニットテスト ~10 件追加
**完了基準**: position 2 つ + preflop 1 つ選んで variant 自動セット、root fetch 成功

### Phase R3: セクション 4-5 (BoardSummary + OOPActions) (~45 分)

| 作業 | 詳細 |
|---|---|
| `FlopBoardSummary.tsx` 改修 | OOP/IP **横並び** に変更、ヘッダ「(role) (position)」、大カード中央 |
| OOP/IP role 判定 helper | `getOOP(data)` / `getIP(data)` / `isOOPTurn(data)` 等を view 内 inline で |
| `FlopOOPActions.tsx` 新規 | 5 列 table (記号 / action / size% / mix% / button) |
| 既存 `STRATEGY_TEXT_COLORS` / 記号 logic 流用 | 各行の色付け、記号は classifyByPlayRate |
| 0% アクション非表示 | Phase 6 で確立した Math.round(freq*100) > 0 を継続 |
| `FlopStrategyView.tsx` 改修 | OOP turn 時に OOPActions を mount、IP turn 時に readonly highlight |

**変更ファイル**: `FlopBoardSummary.tsx`, 新規 `FlopOOPActions.tsx`, `FlopStrategyView.tsx`
**テスト**: なし (UI component、手動確認)
**完了基準**: variant 決定後に Summary と OOP table が表示、クリック反応する (まだ IP は表示しない)

### Phase R4: セクション 6-7 (IPActions + dual-action + History) (~75 分)

| 作業 | 詳細 |
|---|---|
| `FlopIPActions.tsx` 新規 | OOPActions と同形式 (table)、待機モード (grayed out) を internal state で持つ |
| dual-action state machine | `FlopStrategyView` 内で `oopPendingAction` state + tempChain 計算 |
| IP node の async fetch | useFlopNode(variant, tempChain) を OOPPending 時のみ呼ぶ |
| OOP の取消ボタン | OOPActions 行の選択中 action を再クリックで pending 解除 |
| `FlopBreadcrumb.tsx` 改修 | Section 7 として最下部配置、新 chain step ラベル形式に合わせる |
| terminal 状態の handling | next node に available_actions がない場合「アクション終了」表示 |

**変更ファイル**: 新規 `FlopIPActions.tsx`, `FlopStrategyView.tsx`, `FlopBreadcrumb.tsx`
**テスト**: dual-action state machine の logic 部分を integration.test.ts に追加 (mock fetch、~5-8 件)
**完了基準**: OOP クリック → IP 表示 → IP クリック → 次 round の OOP 表示、Breadcrumb で履歴遡及

### Phase R5: 統合・テスト・パフォーマンス (~30 分)

| 作業 | 詳細 |
|---|---|
| `FlopBoardList.tsx` 配置調整 | Section 7 (履歴) の後、最下部の折りたたみへ |
| `MobileFlopView.tsx` 確認 | 新 FlopStrategyView がそのまま動くか確認 (旧 view を返してた場合は新 view に切替) |
| 旧 components 削除 | 未参照になった `FlopActionTotalsCard.tsx` 等を削除 |
| 全 lint / tsc / test / build | 全 GREEN 確認 |
| パフォーマンス測定 | OOP 選択時の IP fetch のレイテンシを実測 |
| docs 更新 | `FLOP_STRATEGY_TAB.md` / `FLOP_UX_SPEC.md` に「v2 改修済」セクション追加 |

**変更ファイル**: 上記 + docs
**テスト**: 全件 GREEN、新規追加分含む
**完了基準**: 全自動テスト PASS、ブラウザ確認 (手動) で 7 セクション + dual-action 動作

## 6. 既存テストへの影響範囲

| カテゴリ | 件数 | 影響予測 |
|---|---:|---|
| 既存 preflop test (`scenarios.test.ts`, `normalize.test.ts`, `mobile.test.ts`) | 44 | **影響ゼロ** (修正範囲外) |
| `flopChain.test.ts` / `flopVariants.test.ts` | 76 | **影響ゼロ** (logic 層 KEEP) |
| `flopBoardCanonical.test.ts` / `useFlopNode.test.ts` | 31 | **影響ゼロ** (logic 層 KEEP) |
| `integration.test.ts` (Phase 6 で 14 件追加) | 14 | **影響ゼロ** (mock fetch ベースの logic test) |
| **計** | **174** | **174 件すべて維持** (regression ゼロ目標) |

新規追加予定:
- R2 で variant 判定 helper (positions + bucket → variant) → ~10 件
- R4 で OOP/IP state machine の logic 部分 (mock fetch) → ~5-8 件
- 最終目標: **~190 件 PASS**

UI component の render 試験は引き続き **案 A (手動確認)** 方針継続。

## 7. ブランチ戦略

```bash
# 改修前の現状を凍結 (commit 後にタグ付け)
git tag legacy/phase-0-8 -m "Phase 0-8 完了点、UI 大改修 (R1-R5) 前の last known good"

# 改修作業は main 直接 OR 専用ブランチ
git checkout -b rework/flop-redesign   # 任意、main 直接でも可

# Phase ごとに commit を区切る (R1 → R2 → ... → R5)
# 各 commit メッセージに Phase R<N> プレフィクスを付与

# ロールバックが必要なら:
git reset --hard legacy/phase-0-8     # or git checkout legacy/phase-0-8
```

**推奨**: `legacy/phase-0-8` タグ作成 + main 直接作業。`_legacy/` フォルダは使わない (git history で十分管理可、import path 変更も不要)。

## 8. ユーザー判断事項 (Q1-Q5)

実装着手前に確認したい点。**Q1-Q3 は R2 着手前に必要**、Q4-Q5 は R4-R5 で後追い可。

### Q1. `2bp` の意味 ★必須

候補:
- **A. `2bp` = `srp` の別名** (= 単一レイズポット、ポーカー用語の 1bp=open前=BB option、2bp=open完了、3bp=re-raise...)。両ボタンが同じ variant set を指す。
- **B. `2bp` = limp + iso family** (= `sbc_bbr3_sbc` / `sbc_bbr5_sbc`、SB-only)。`srp` は標準 open-call ツリーのみ。
- **C. 別の解釈** (要明示)

実機データ突合せ:
- `findFlopVariants('SB', 'BB', 'SRP', 'limp')` → `['sbc_bbr3_sbc', 'sbc_bbr5_sbc']` ← B 案で `2bp` ボタンの素材
- `findFlopVariants('SB', 'BB', 'SRP', 'open')` → `['sbr_bbc']` ← A 案/`srp` ボタン
- B 案だと `2bp` は (SB, BB) でしか有効にならない (他は disable)、`srp` と意味的に区別できて学習価値あり

### Q2. SB-only Open/Limp トグル位置 ★必須

旧 UI: Variant Selector 内に開閉あり (Phase 4.1)。
新 UI: Position 6 ボタン + Preflop 6 ボタンの 2 セクション構成だが、「SB を選んだとき Open/Limp は別途指定？」

候補:
- **A. Preflop ボタンで暗黙表現** (Q1 の B 案採用時): `limp` ボタン = limp+check (`sbc_bb`)、`2bp` = limp+iso、`srp` = SB-open-call (`sbr_bbc`)。トグル不要。
- **B. 別ボタンで明示**: 例えば `srp` ボタンクリック後に「SB の場合: open / limp」サブ選択を出す。

→ **A 案** が UI シンプルだが Q1 の B 案採用前提。

### Q3. dual-action の commit タイミング ★必須

候補:
- **A. tentative commit** (本計画書の 4-4 の default): OOP クリック → tempChain 作成 + 子ノード fetch (IP options 表示)、IP クリック で確定。OOP の取消可。
- **B. immediate commit**: OOP クリック → chain 即時更新、ノード遷移 → 新ノードの actor (= IP) のアクションだけが § 6 に表示。OOP 取消は breadcrumb の戻るのみ。

A 案: より自然な「先読み」UX、OOP の取消が簡単。fetch 数は同じ (どのみち子ノード取得が必要)。
B 案: 実装シンプル、現 Phase 0-8 と近い。

→ **A 案推奨** (元要件「§ 6 = OOP の選択待ち」と整合)。

### Q4. Terminal の表現 (R4-R5 で詰める)

flop chain の末端 (next_actor が無くなった/`is_solution_end` 等) の表示:
- 「アクション終了」テキスト + breadcrumb で巻き戻し
- OR: 自動でアクション一覧を全部畳む、Reset を強調

### Q5. 旧 Mobile view の扱い (R5 で詰める)

`MobileFlopView` は現 PC `FlopStrategyView` の thin wrapper。新版でも同じ wrapper にするか、Mobile 専用 layout を Phase R5 で別途作るか。

→ **R5 で実機確認**: 新 FlopStrategyView が responsive に動けば wrapper 継続、レイアウト崩れなら bespoke 化。

## 9. 工数見積もり

| Phase | 内容 | 想定時間 |
|---|---|---:|
| R1 | バックアップ + scaffolding | 15 分 |
| R2 | § 1-3 (Input / Position / Preflop) | 60 分 |
| R3 | § 4-5 (BoardSummary + OOPActions) | 45 分 |
| R4 | § 6-7 (IPActions + state machine + History) | 75 分 |
| R5 | 統合・テスト・パフォーマンス | 30 分 |
| **合計** | | **~225 分 (~3.75 時間)** |

実装の不確実性 (dual-action state machine、SB Open/Limp ハンドリング) を考慮し +30% バッファ ≒ **5 時間想定**。

## 10. リスクと対策

| リスク | 影響度 | 対策 |
|---|---|---|
| 既存 preflop 機能の regression | 致命的 | UI 層のみ修正、preflop 関連コードは触らない。既存 44 件のテストで自動検知 |
| logic 層 (useFlopNode 等) の意図せぬ破壊 | 大 | logic 層は KEEP リスト (§3-2) のみ、改修ファイルから除外 |
| dual-action state の race condition (fetch 中の OOP 取消等) | 中 | AbortController を tempChain fetch に渡す、`useFlopNode` 既存 cleanup 流用 |
| variant 判定の edge case (UTG-HJ-srp 等) | 小 | `findFlopVariants` を流用、テスト R2 で網羅 |
| パフォーマンス劣化 (毎クリック fetch) | 小 | 子ノード fetch は ~400ms TTFB (R2 実測)、ローカル試験で問題なし |
| ロールバックできない状況 | 小 | `legacy/phase-0-8` タグで凍結、`git reset --hard` で復帰可 |

## 11. ユーザー確認ポイント

実装着手前に以下を確定:

- [ ] Q1: `2bp` の意味 (A: srp 同義 / B: limp+iso family / C: その他)
- [ ] Q2: SB Open/Limp トグル方針 (A: Preflop ボタンで暗黙 / B: 別トグル)
- [ ] Q3: dual-action commit 方針 (A: tentative + 取消可 / B: 即時 commit)
- [ ] ブランチ戦略 (main 直接 / `rework/flop-redesign` 専用)
- [ ] 開始 OK か (R1 着手)

確定したら R1 に着手します。
