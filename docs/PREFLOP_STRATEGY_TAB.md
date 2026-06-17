# Preflop Range データ R2 配信 (Phase 1)

新 preflop range (GTO) データを flop と同方式で Cloudflare R2 から配信するための
基盤。Phase 1 は **データ準備のみ** で、アプリの動作は既存の preflop データ
(`public/data/preflop/cash_100bb_6max_nl500_2.5x/`) のまま変わらない。新ローダの
配線は Phase 2 で行う。

既存 flop 配信 (`docs/FLOP_STRATEGY_TAB.md` §4, `src/hooks/useFlopNode.ts`,
`VITE_FLOP_DATA_BASE_URL`) を踏襲している。

## 1. 元データ

- 場所: `preflop_ranges/<config>/by_chain/<chain>.json` (生スクレイプ出力、772 MB、git 非追跡)
- 形式: アクション連鎖ファイル名 (例 `F_R2_R6_5.json` = F→R2bb→R6.5bb)
- config (スタック × レーキ × open size):

  | config | by_chain ファイル | 状態 |
  |---|---|---|
  | cash_20bb_6max_nl500_gto | 554 | OK |
  | cash_50bb_6max_nl500_gto | 1269 | OK |
  | cash_75bb_6max_nl500_gto | 1596 | OK |
  | cash_100bb_6max_nl500_gto | 1380 | OK |
  | cash_100bb_6max_nl50_gto | 67 | OK |
  | cash_150bb_6max_nl500_gto | 2465 | OK |
  | cash_200bb_6max_nl500_gto | 2405 | OK |
  | cash_100bb_6max_nl500_2.5x | 4 | **不完全** (by_chain が別 raw schema。`hands` なし → 変換対象外) |
  | cash_50bb_6max_nl500_2.5x | 0 | **空** (by_chain なし) |

  → 変換できるのは 7 つの `*_gto` config (計 9736 ノード)。2 つの `2.5x` config は
  新データ側が不完全なため出力されない。2.5x は既存 production
  (`public/data/preflop/cash_100bb_6max_nl500_2.5x/`、旧形式) が現役のため影響なし。

## 2. 変換 (`scripts/build-preflop-data.cjs`)

```bash
npm run build:preflop-data                       # 全 config
node scripts/build-preflop-data.cjs <config> ... # 個別指定
```

- 入力: `preflop_ranges/<config>/by_chain/*.json`
- 出力: `dist-preflop-data/v1/<config>/by_chain/<chain>.json` (minify 済、git 非追跡)
- 変換内容:
  - `hands[H].actions_aggregated` (0-1) → flat `{allin, raise, call, fold}` (0-100, `call_or_check`→`call`)。既存 `RawStrategyFile` の hand 形に合わせ Phase 2 で再利用可
  - `hands[H].evs_aggregated` → `hands[H].evs {allin, raise, call, fold}` (将来 Equity 用に保持、null はそのまま保持)
  - `hands[H].range_weight` 保持
  - `_meta` / `game_info` / `actions_legend` / `actions_aggregated_legend` / `action_totals_aggregated` 保持 (パンくず・ノードメタ用)
  - 生サイズ別の `hands[H].actions` / `hands[H].evs` / top-level `action_totals` は破棄 (集約値で十分)
  - `hands` を持たない非標準ファイルは skip (変換しない)
- 出力規模: **9736 ファイル / ~224 MB (minify) / ~24 MB (gzip)**、所要 ~6.5 秒、決定的 (同入力→同出力)

## 3. R2 アップロード手順 (手動、ユーザー実施)

flop と同じ public bucket を再利用し、path prefix `/data/preflop/v1/` で追加する想定
(別 bucket でも可。その場合は §5 の env と vite proxy の host を差し替え)。

URL 規約:
```
https://<r2-public-host>/data/preflop/v1/<config>/by_chain/<chain>.json
```
- `/v1/` は flop と同じく versioning 用。再スクレイプ時は `/v2/` を新設して切替
- アプリ側 base URL は `/v1` まで (config は app が付与) ← flop と異なる点

**1. bucket (flop と同じものを使う場合は新規作成不要)**
- 既存 flop bucket (`pub-15ae08e085da4c138ef4f04dde1dbfeb.r2.dev` の実体) をそのまま使用
- 別 bucket にする場合: Cloudflare ダッシュボード → R2 → Create bucket、Public access 有効化

**2. データアップロード (~224 MB / 9736 ファイル)**

`rclone` 推奨 (flop と同じ remote 設定を流用):
```bash
# data/preflop/v1/ 配下に丸ごとコピー
rclone copy \
  /Users/shirairyouitaru/pokerprojects/pokergtoapp/dist-preflop-data/v1 \
  r2:<bucket>/data/preflop/v1 \
  --transfers=20 --progress
```

`wrangler` 単一ファイルテスト:
```bash
wrangler r2 object put <bucket>/data/preflop/v1/cash_100bb_6max_nl500_gto/by_chain/F_R2_R6_5.json \
  --file dist-preflop-data/v1/cash_100bb_6max_nl500_gto/by_chain/F_R2_R6_5.json
```

**3. CORS 設定**
- flop と同じ bucket を使う場合、既存 CORS (Pages domain + `http://localhost:5173`) がそのまま効くため追加不要
- 別 bucket の場合は flop と同じ CORS を設定:
```json
[
  {
    "AllowedOrigins": ["https://<pages-domain>", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

**4. 動作確認**
```bash
curl -I "https://<r2-public-host>/data/preflop/v1/cash_100bb_6max_nl500_gto/by_chain/F_R2_R6_5.json"
# 200 OK + Content-Type: application/json を確認
```

## 4. 環境変数

| ファイル | 値 | 用途 |
|---|---|---|
| `.env.example` | `https://pub-xxxxxxxx.r2.dev/data/preflop/v1` | テンプレート (commit 済) |
| `.env.local` | 実 R2 URL (`.../data/preflop/v1`) | 本番ビルド / dev の絶対 URL (gitignore) |
| `.env.development.local` | `/r2-preflop` | dev は Vite proxy 経由で CORS 回避 (gitignore) |
| `.env.production` | 実 R2 URL | 本番 (gitignore) |
| Cloudflare Pages 環境変数 | 実 R2 URL | 本番デプロイ |

dev proxy は `vite.config.ts` の `/r2-preflop` → `<host>/data/preflop/v1` で定義済
(flop の `/r2-flop` と同形式)。**Phase 1 ではまだ app から参照されない** (Phase 2 で配線)。

## 5. 次のステップ (Phase 2)

1. ユーザーが §3 で全 7 config を R2 にアップロード、`VITE_PREFLOP_DATA_BASE_URL` を Pages に登録
2. アプリ改修指示書 (別途): `useStrategy.ts` / `scenarios.ts` の新ローダ対応 (アクション連鎖名・深いノード木)、`availableNodes.ts` 再生成、config 選択 UI、パンくず再構築
