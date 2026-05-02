---
name: SCHEMA
description: Preflop Strategy Viewer の JSON データ仕様 (v1.1.0)
---

# JSON Schema 仕様書

このドキュメントは、Preflop Strategy Viewer で使用するソルバー出力 JSON の**厳密な仕様**を定義する。
スキーマは**契約**であり、表示側・データ生成側の両方がこれに従う。

## バージョン

現在: **1.2.0**

スキーマ変更時はバージョンをアップデートし、後方互換性を考慮すること。

### 変更履歴
- **1.2.0** (2026-05-02): `hands` を **sparse 形式** に変更。
  「parent ノードで reach action 頻度が 0% のハンド」はキーごと省略する。
  これにより、UI で「親で到達してないハンドが fold=100 で表示される」バグを根本解消。
  詳細は §「sparse 形式の規則」を参照。
- **1.1.0** (2026-05-02): GTO Wizard ソルバー出力フォーマットに完全移行。
  4アクション固定 (`fold` / `call` / `raise` / `allin`)、確率は **0–100 (%)** 表記、
  `metadata` 形式を廃止し `game_info` ツリーノード形式を正規化。`raise` は全サイズ統合。
- **1.0.0** (initial): カスタム `metadata` + `actions[]` 配列 + `strategy` 配列形式 (廃止)

## トップレベル構造

```typescript
{
  game_info: GameInfo,                  // ノード情報・アクション履歴・ソルバー設定
  actions_legend: Record<string,string>, // アクションキーの説明 (人間向けラベル)
  hands: Record<HandName, HandStrategy>  // 169ハンド × 4アクション頻度
}
```

> 注: 旧 v1.0.0 にあった `schema_version` / `metadata` / `actions[]` フィールドは存在しない。
> 表示側は `game_info` から必要情報を導出し、169ハンド × 4アクションの固定形を前提に組む。

## GameInfo

```typescript
interface GameInfo {
  scenario: string;                  // 表示名 (例: "UTG vs BB")
  node_path: string;                 // ファイル名サフィックスと一致 (例: "utgr_bb")
  step: number;                      // ルートからの深さ (1: RFI判断ノード, 2: vs RFI 判断ノード, ...)
  hero_position: Position;           // この時点で判断するプレイヤー
  active_positions: Position[];      // まだ降りていないプレイヤー
  folded_positions: Position[];      // 既にフォールドしたプレイヤー
  action_history: ActionHistoryEntry[]; // hero に至るまでのアクション (時系列)
  is_leaf: boolean;                  // true ならツリー末端 (これ以降のノードファイルなし)
  available_actions_at_this_node: AvailableAction[];  // hero が取れるアクション
  solution: SolutionMeta;            // ソルバー設定 (キャッシュ/スタック/オープンサイズ等)
  cash_settings?: CashSettings;      // ルートノードなど一部にのみ存在
}

type Position = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB"

interface ActionHistoryEntry {
  position: Position;
  action: "Fold" | "Call" | "Raise 2.5" | "Raise 3" | "Raise 7.5" | "Allin" | string;
  // ※ アクション文字列はサイズ込みで記述される (例: "Raise 7.5" = 7.5BBへリレイズ)
}

type AvailableAction = "Fold" | "Call" | "Raise" | "Allin"

interface SolutionMeta {
  game_type: "Cash";
  stack: "100bb" | string;
  players: "6max" | string;
  rake: "NL500" | string;
  type: "Classic" | "General";
  opening_size: "2.5x" | string;
  bet_sizes: "General" | "GTO" | string;
  postflop_bet_sizes: "Multi Size" | string;
}

interface CashSettings {
  game_type?: "Cash";
  max_players?: number;
  depth?: number;
  rake_structure?: string;
  open_size?: string;
  // 他オプションあり
}
```

### `node_path` の命名規則

ポジション略号 + アクション接尾辞をアンダースコア区切りで連結し、末尾に hero ポジションを付ける。

| 略号 | 意味 |
|---|---|
| `utg`, `hj`, `co`, `btn`, `sb`, `bb` | ポジション (lowercase) |
| `r` (suffix) | raise |
| `c` (suffix) | call |
| `ai` (suffix) | all-in |

例:
- `utg.json` — UTGがRFI判断 (step=1)
- `utgr_bb.json` — UTGオープン後にBBが判断 (step=2, vs RFI)
- `cor_btnr_co.json` — CO open → BTN 3bet → CO が4bet以下を判断 (step=4)
- `btnr_sbr_btnr_sbai_btn.json` — BTN open → SB 3bet → BTN 4bet → SB AI → BTN判断
- `sbc_bbr_sb.json` — SB が limp → BB raise → SB判断

## actions_legend

アクションキー → 人間向けラベル。**4キー固定**。

```json
{
  "allin": "all-in",
  "raise": "raise (all sizes combined)",
  "call": "call",
  "fold": "fold"
}
```

> **重要**: `raise` は同一ノードでの全raiseサイズの**合算頻度**。サイズ別の内訳は提供されない。
> サイズが必要な場合は `game_info.action_history` の文字列（例: `"Raise 7.5"`）を参照する。

## hands

ハンドをキーにし、各ハンドのアクション頻度を返す。**v1.2.0 から sparse 形式**：
このノードに到達するハンドだけがキーとして含まれる（不到達ハンドは省略）。

```typescript
type HandName = string  // 169通り中、このノードに到達するもの (詳細は下記)

interface HandStrategy {
  fold:  number   // 0 〜 100 (%)
  call:  number   // 0 〜 100 (%)
  raise: number   // 0 〜 100 (%) — 全raiseサイズ合算
  allin: number   // 0 〜 100 (%)
}
```

### 確率の制約

- 各値は **0 〜 100 (%)** の浮動小数点数
- 4アクションの**合計は 100 ± 0.1** (浮動小数点誤差を許容)
- 取れないアクションは `0`

### sparse 形式の規則 (v1.2.0)

「このノードに到達するハンド」とは、**hero がこのノードに至るまでに取った最直近アクション**で、
parent ノードでの当該アクション頻度が `> 0%` のハンドを指す。

#### 規則

1. **depth 1 (RFI ルート)**: hero がまだ行動していないので、169ハンド全部含む。
2. **depth 2 で hero がまだ行動していないノード** (例: `utgr_bb` の hero=BB): 同様に 169ハンド全部含む。
3. **それ以外 (hero が過去に行動済み) のノード**: hero の最直近アクションでの parent 該当頻度 0% のハンドはキー自体を省略。

#### parent と reach action の決定方法

子ノードの `node_path` を `_` で分割し、後ろから走査して **hero と同じポジションが actor** となる
action segment を探す。見つかった segment の suffix (`r`/`c`/`ai`) が reach action、
それより前の segments + 該当ポジション = parent の `node_path`。

例:
- 子 `utgr_bbr_utg.json` (hero=UTG)
  - segments = `[utgr, bbr, utg]`
  - 後ろから走査: `bbr` の actor=BB ≠ UTG → `utgr` の actor=UTG ✓
  - parent = `utg.json`、reach action = `raise`
  - → `utg.json` の hands で `raise > 0` のハンドだけ子に含まれる
- 子 `cor_btnr_co.json` (hero=CO)
  - segments = `[cor, btnr, co]`
  - 後ろから走査: `btnr` の actor=BTN ≠ CO → `cor` の actor=CO ✓
  - parent = `co.json`、reach action = `raise`
  - → `co.json` の hands で `raise > 0` のハンドだけ含まれる

#### sparse化の実用的な効果

| 視点 | 効果 |
|---|---|
| データ量 | 17,914 entries → 5,286 entries（約 70% 削減） |
| 表示 | UI が「parent で UTG が 72o をオープンしないのに 4-bet局面で 72o が表示される」のを防ぐ |
| AggregateReport | 不到達ハンドが集計に含まれず、現実的な % が出る |

#### depth 別のハンド数目安 (cash_100bb_6max_nl500_2.5x の実測)

| depth | n  | min | max | avg |
|---|---|---|---|---|
| 1 (RFI ルート) | 5  | 169 | 169 | 169 (全保持) |
| 2 (hero未行動) | 17 | 169 | 169 | 169 (全保持) |
| 3 | 32 | 54  | 108 | 69.9 |
| 4 | 32 | 32  | 141 | 53.4 |
| 5 | 29 | 21  | 72  | 37.7 |
| 6 | 13 | **0** | 54  | 18.8 |

**注**: depth 6 で `hands: {}` が発生するノードもある (戦略的に到達しないが
ツリー構造として存在するノード)。UI 側で空ハンド対応をしていれば問題ない。

### ハンド表記ルール (プリフロップ)

**169通り**を以下の形式で表記:

| 種別 | 形式 | 例 |
|---|---|---|
| ペア | `RR` (ランク2文字) | `AA`, `KK`, `22` |
| スーテッド | `RRs` (高ランク+低ランク+s) | `AKs`, `T9s`, `72s` |
| オフスーツ | `RRo` (高ランク+低ランク+o) | `AKo`, `T9o`, `72o` |

ランク表記: `A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2`
**T はテン (10)** であることに注意。

**並び順**: 高ランクが先 (`AKs` ✓, `KAs` ✗)

### 完全な169ハンドリスト

```
Pairs (13):
  AA, KK, QQ, JJ, TT, 99, 88, 77, 66, 55, 44, 33, 22

Suited (78):
  AKs, AQs, AJs, ATs, A9s, A8s, A7s, A6s, A5s, A4s, A3s, A2s
  KQs, KJs, KTs, K9s, K8s, K7s, K6s, K5s, K4s, K3s, K2s
  QJs, QTs, Q9s, Q8s, Q7s, Q6s, Q5s, Q4s, Q3s, Q2s
  JTs, J9s, J8s, J7s, J6s, J5s, J4s, J3s, J2s
  T9s, T8s, T7s, T6s, T5s, T4s, T3s, T2s
  98s, 97s, 96s, 95s, 94s, 93s, 92s
  87s, 86s, 85s, 84s, 83s, 82s
  76s, 75s, 74s, 73s, 72s
  65s, 64s, 63s, 62s
  54s, 53s, 52s
  43s, 42s
  32s

Offsuit (78):
  AKo, AQo, AJo, ATo, A9o, A8o, A7o, A6o, A5o, A4o, A3o, A2o
  KQo, KJo, KTo, K9o, K8o, K7o, K6o, K5o, K4o, K3o, K2o
  QJo, QTo, Q9o, Q8o, Q7o, Q6o, Q5o, Q4o, Q3o, Q2o
  JTo, J9o, J8o, J7o, J6o, J5o, J4o, J3o, J2o
  T9o, T8o, T7o, T6o, T5o, T4o, T3o, T2o
  98o, 97o, 96o, 95o, 94o, 93o, 92o
  87o, 86o, 85o, 84o, 83o, 82o
  76o, 75o, 74o, 73o, 72o
  65o, 64o, 63o, 62o
  54o, 53o, 52o
  43o, 42o
  32o
```

合計: 13 + 78 + 78 = **169**

### 組み合わせ数 (集約レポート用)

各ハンドが実際に存在する組み合わせ数:

| 種別 | 組み合わせ数 |
|---|---|
| ペア | 6 |
| スーテッド | 4 |
| オフスーツ | 12 |

合計: 13×6 + 78×4 + 78×12 = 78 + 312 + 936 = **1326** (= 52C2)

## ファイル配置

```
public/data/preflop/
└─ cash_100bb_6max_nl500_2.5x/
   ├─ utg.json                    # RFI: UTG
   ├─ hj.json, co.json, btn.json, sb.json
   ├─ utgr_bb.json                # vs RFI: BB facing UTG
   ├─ utgr_sb.json, utgr_btn.json, utgr_co.json, utgr_hj.json
   ├─ hjr_*.json (4 files)
   ├─ cor_*.json (3 files)
   ├─ btnr_*.json (2 files)
   ├─ sbr_bb.json
   └─ ...                         # 3bet, 4bet, AI ノード (合計 ~128 ファイル)
```

ディレクトリ名 `cash_100bb_6max_nl500_2.5x` は **ソルバー設定の識別子**。
将来 `cash_50bb_6max_nl1k_3x` 等の別設定を追加する際は、新ディレクトリを切る。

## バリデーション要件

実装時は以下をチェック:

1. **必須フィールド**: `game_info`, `actions_legend`, `hands` がすべて存在
2. **ハンドキー妥当性**: `hands` のキーは169ハンド集合の部分集合 (sparse 形式、§「sparse 形式の規則」)
3. **アクション4種揃い**: 各 `hands[name]` に `fold`, `call`, `raise`, `allin` キーが揃っている
4. **確率合計**: 各 `hands[name]` の合計が 100 ± 0.1
5. **値域**: 各確率が 0 〜 100
6. **node_path 一貫性**: `game_info.node_path` がファイル名 (拡張子除く) と一致
7. **reach 整合性 (推奨チェック)**: depth ≥ 3 では各キーが parent ノードの reach action 頻度 > 0 を満たす

## 完全なサンプル

```json
{
  "game_info": {
    "scenario": "UTG vs BB",
    "node_path": "utgr_bb",
    "step": 2,
    "hero_position": "BB",
    "active_positions": ["UTG", "BB"],
    "folded_positions": ["HJ", "CO", "BTN", "SB"],
    "action_history": [
      {"position": "UTG", "action": "Raise 2.5"},
      {"position": "HJ",  "action": "Fold"},
      {"position": "CO",  "action": "Fold"},
      {"position": "BTN", "action": "Fold"},
      {"position": "SB",  "action": "Fold"}
    ],
    "is_leaf": false,
    "available_actions_at_this_node": ["Allin", "Raise", "Call", "Fold"],
    "solution": {
      "game_type": "Cash",
      "stack": "100bb",
      "players": "6max",
      "rake": "NL500",
      "type": "Classic",
      "opening_size": "2.5x",
      "bet_sizes": "General",
      "postflop_bet_sizes": "Multi Size"
    }
  },
  "actions_legend": {
    "allin": "all-in",
    "raise": "raise (all sizes combined)",
    "call": "call",
    "fold": "fold"
  },
  "hands": {
    "AA": { "allin": 0, "raise": 100, "call": 0,   "fold": 0 },
    "KK": { "allin": 0, "raise": 100, "call": 0,   "fold": 0 },
    "...": "親で reach action > 0 のハンドのみキーが存在する (sparse 形式 v1.2.0)"
  }
}
```

## 表示側における推奨アクション順とカラー

| アクションID | 表示順 | ラベル | カラー |
|---|---|---|---|
| `fold`  | 0 | Fold     | `#0284c7` (青) |
| `call`  | 1 | Call     | `#16a34a` (緑) |
| `raise` | 2 | Raise    | `#dc2626` (赤) |
| `allin` | 3 | All-in   | `#9333ea` (紫) |

> raise はサイズ統合のため、表示上は単一帯。サイズの内訳は `action_history` から推測する以外なし。

## フロップ以降のスキーマ (フェーズ2、参考)

将来のフロップ対応時の拡張案 (まだ確定ではない):

```typescript
{
  game_info: { ...GameInfo, flop: ["As", "Kh", "7d"] },
  tree: {
    root: string,
    nodes: {
      [nodeId: string]: {
        player: "OOP" | "IP",
        actions: AvailableAction[],
        children: { [actionId: string]: string },
        hands: {
          [combo: string]: { fold: number, call: number, raise: number, allin: number }
          // combo は 1225通りの具体手札 (例: "AsKh")
        }
      }
    }
  }
}
```

ハンドは **1225組み合わせ** (具体的な手札、例: `AsKh`)。
