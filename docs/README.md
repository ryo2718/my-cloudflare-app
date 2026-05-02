# Preflop Strategy Viewer - Claude Code 引き継ぎ指示書

## このプロジェクトの目的

ポーカー (NLHE 6max) のプリフロップGTO戦略を表示するWebアプリを作る。

将来的にはフロップ以降も対応するが、**まずプリフロップ表示を完成させる**。
**計算ロジックと表示ロジックを完全に分離**し、JSONを契約 (contract) として両者を独立に開発できるようにする。

## ユーザーについて

- ポーカー知識: 中級〜上級 (GTO、SRP、3bet、AIなどの用語を普通に使う)
- 開発経験: Claude/Claude Codeを使ってアプリ開発する経験あり
- 言語: 日本語で会話
- マシン: Windows 11 / i7-12700KF / RAM 64GB / RTX 3060 Ti / Node.js環境想定

## アプリ要件 (確定済み)

### 機能要件
- **プリフロップ戦略表示** (フェーズ1、今ここ)
  - 13×13ハンドマトリクス
  - アクション比率の縦帯グラデーション表示
  - ハンド詳細表示 (hover)
  - 集約レポート (各アクション頻度の全体%)
  - シナリオ切り替え (RFI / 3bet / 4bet / 5bet / 6bet AI)
  - ポジション切り替え (UTG/MP/CO/BTN/SB/BB)
- **フロップ戦略表示** (フェーズ2、将来)
  - 1755フロップから選択
  - ノードツリー操作
  - 1225組み合わせ表示

### 非機能要件
- **静的Webアプリ** (サーバーレス)
- **公開デプロイ先**: Cloudflare Pages (帯域無制限・無料)
- **想定ユーザー数**: 最大50人
- **ライセンス**: 自由 (ソルバー本体を同梱しないのでAGPL感染なし)

### 技術スタック
- **フレームワーク**: React (理由: AIアシストの精度・拡張性・エコシステム)
- **ビルドツール**: Vite
- **スタイリング**: 現在はインラインstyle (シンプルさ優先)、将来Tailwind移行検討
- **データ形式**: JSON (1ポジション/シナリオ=1ファイル)
- **データ配信**: 静的ファイルとして同梱、`fetch()`で読み込み

## データ仕様

### ファイル命名規則 (確定済み)
```
アクション_ポジション[_vs_相手].json
```

例:
- `rfi_utg.json` (UTGのオープンレンジ)
- `3bet_btn_vs_utg.json` (BTNがUTGに3betするか)
- `vs_3bet_utg_vs_btn.json` (UTGがBTNに3betされた時)
- `4bet_utg_vs_btn.json` (UTGが3bet後に4betするか)
- `vs_4bet_btn_vs_utg.json` (BTNが4betされた時)
- `5bet_utg_vs_btn.json`
- `vs_5bet_btn_vs_utg.json`
- `6bet_ai_btn_vs_utg.json` (オールイン圏内、最終)

### ディレクトリ構造
```
data/
├ rfi/              # オープンレンジ
├ 3bet/             # 3betする側
├ vs_3bet/          # 3betされた側
├ 4bet/
├ vs_4bet/
├ 5bet/
├ vs_5bet/
└ 6bet_ai/          # 6bet=オールイン
```

### JSONスキーマ
詳細は `SCHEMA.md` を参照。

要点:
- `metadata`: シナリオ情報
- `actions`: アクション定義 (id, label, size_bb, color)
- `strategy`: ハンド名→[各アクション確率配列]

ハンド表記は **169通り** (例: `AA`, `AKs`, `AKo`)
- ペア: 2文字 (例: `AA`, `22`)
- スーテッド: 3文字、`s`サフィックス (例: `AKs`)
- オフスーツ: 3文字、`o`サフィックス (例: `AKo`)

## プロジェクト構造 (推奨)

```
preflop-viewer/
├ public/
│  └ data/                    # JSON置き場
│     ├ rfi/
│     ├ 3bet/
│     └ ...
├ src/
│  ├ App.jsx                  # ルート
│  ├ components/
│  │  ├ HandMatrix.jsx        # 13×13マトリクス
│  │  ├ HandCell.jsx          # 1セル
│  │  ├ HandDetail.jsx        # 詳細パネル
│  │  ├ AggregateReport.jsx   # 集約レポート
│  │  └ ScenarioSelector.jsx  # シナリオ選択UI
│  ├ hooks/
│  │  └ useStrategy.js        # JSON読み込みフック
│  ├ utils/
│  │  ├ hands.js              # ハンド名生成、組み合わせ数
│  │  └ schema.js             # スキーマバリデーション
│  └ main.jsx
├ package.json
├ vite.config.js
└ README.md
```

## 開発の進め方 (推奨ロードマップ)

### Phase 1: 基盤構築 (今ここから)
1. **Viteプロジェクト初期化**
   ```bash
   npm create vite@latest preflop-viewer -- --template react
   cd preflop-viewer
   npm install
   ```
2. **既存の `preflop-viewer.jsx` を `src/App.jsx` ベースに移植**
3. **コンポーネント分割** (現在は単一ファイルなので)
4. **動作確認**: `npm run dev`

### Phase 2: 外部JSON読み込み
1. `public/data/rfi/rfi_utg.json` 配置 (既存ファイル流用)
2. `useStrategy` フック作成: `fetch('/data/rfi/rfi_utg.json')`
3. ローディング/エラー表示
4. **動作確認**: ハードコードデータと同じ表示になるか

### Phase 3: シナリオ切り替えUI
1. シナリオ一覧の定義 (どのファイルが存在するか)
2. ドロップダウン or タブUI
3. URLハッシュとの同期 (`#scenario=rfi_utg` など)、シェアしやすくする

### Phase 4: ダミーデータ拡充
- 全ポジションのRFI (UTG/MP/CO/BTN/SB)
- 主要な3bet/vs_3betシナリオ
- 値はテキトーでOK、構造確認が目的

### Phase 5: デプロイ
1. GitHubリポジトリ作成 (プライベートでもOK)
2. Cloudflare Pages連携
3. ビルドコマンド: `npm run build`、出力ディレクトリ: `dist`
4. 公開URL確認

### Phase 6 (将来): 計算側との連携
- Desktop Postflopなどのソルバー出力をこのスキーマに変換するスクリプト作成
- ただし**スキーマは絶対に変えない** (表示側との契約)

## 設計上の判断記録

### 決まったこと

| 項目 | 決定 | 理由 |
|---|---|---|
| ハンド粒度 (プリフロップ) | 169通り | プリフロップは組み合わせ区別不要 |
| ハンド粒度 (フロップ以降) | 1225組み合わせ | フロップ3枚を除いた49C2 |
| EV含むか | 含めない | 軽量化、戦略確率だけで十分 |
| ファイル粒度 | 1シナリオ=1ファイル | 遅延ロード、CDNキャッシュ効率 |
| ノード構造 (フロップ用) | フラット参照 | JSON軽量化 |
| フレームワーク | React | AIアシスト精度、拡張性 |
| ベットサイズ (将来のフロップ用) | 未確定 | 計算負荷との兼ね合いで後で決める |

### 保留中

- **3betの両視点ファイルを両方作るか** (yes、ただしまずは片側から)
- **将来のフロップ計算設定** (4サイズ vs 3サイズ、深さ3 vs 4)
- **テーブルサイズ** (まず6max、将来HU対応)
- **スタックサイズ** (まず100bb、将来複数対応)

## 重要な制約・ルール

1. **JSONスキーマは契約**: 一度決めたら表示側・計算側で勝手に変えない。変える時はバージョンアップ (`schema_version`) して両側合意
2. **ソルバー本体をアプリに含めない**: AGPL感染回避のため、計算結果のJSONだけ配信
3. **データは全部静的**: サーバーレス前提、`fetch()`で読み込むだけ
4. **計算ロジックの実装はこのリポジトリではやらない**: 別リポジトリで管理 (将来)

## 既存ファイル (引き継ぎ済み)

- `rfi_utg.json` - サンプルデータ (UTG RFI、169ハンド全部入り)
- `preflop-viewer.jsx` - 表示アプリ雛形 (シングルファイル、動作確認済み)
- `SCHEMA.md` - JSONスキーマ仕様書
- `DECISIONS.md` - 設計判断の経緯

## ユーザーとのやり取りのコツ

- **ボタン形式の選択肢で質問する** (`ask_user_input` ツール)
- **ポーカー用語は通じる**ので、噛み砕きすぎない
- **複数選択肢の比較**を求められたら、メリット・デメリットを表で出す
- **マシンスペックは把握済み** (i7-12700KF / 64GB / RTX 3060 Ti)
- **法的リスク・著作権には敏感**、慎重に扱う
- **「お任せ」と言われた時は推奨案を示す**

## Claude Codeへの引き継ぎ初回メッセージ案

```
こんにちは。ポーカーのプリフロップGTO戦略表示アプリを作っています。
前任のClaudeとの会話で、要件・スキーマ・初期コードまで決まっています。

引き継ぎ資料:
- README.md (このファイル) - 全体の指示書
- SCHEMA.md - JSON仕様
- DECISIONS.md - 設計判断
- rfi_utg.json - サンプルデータ
- preflop-viewer.jsx - 雛形コード

まずREADMEを読んで、Phase 1 (Viteプロジェクト初期化〜コンポーネント分割) から進めてください。
```
