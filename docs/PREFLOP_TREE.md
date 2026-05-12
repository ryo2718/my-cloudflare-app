# Preflop Solution Tree

**Solution**: `cash_100bb_6max_nl500_2.5x`  
**Total nodes (files)**: 128  
**Path**: `public/data/preflop/cash_100bb_6max_nl500_2.5x/<node_path>.json`

## ノード命名規則

`<chain>` の構造で、サフィックスがアクションを表す:

| サフィックス | 意味 |
|---|---|
| `r_<pos>` | 直前ポジションが **raise** → `<pos>` が応答 |
| `ai_<pos>` | 直前ポジションが **all-in** → `<pos>` が応答 |
| `c_<pos>` | 直前ポジションが **call (limp)** → `<pos>` が応答 |

例: `utgr_bbr_utg` = UTG raise → BB raise → UTG action

## ツリー記法

- 各行: `node_path [Hero step=N → 選択肢] [(leaf)]`
- 子ノードに ASCII 罫線で接続 (`├─` / `└─`)
- `raise` / `allin` / `call(limp)` は別ファイルが存在するので子ノードとして展開
- `call → flop` / `call → showdown` / `check → flop` は **preflop終端**: そこから先のレンジファイルは無い (street 跨ぐ)
- `fold` は当然ハンド終了なので省略
- **(leaf)**: 全ハンド該当ノードで全員 fold/call/allin 確定済み、その先に応答ファイルが無いことを示す (例: all-in 応答後)

## Root: `utg` (UTG open)

```
**utg** — `UTG` step 1 → {Raise / Fold}
    ├─ raise → **utgr_bb** — `BB` step 2 → {Allin / Raise / Call / Fold}
    │   ├─ raise → **utgr_bbr_utg** — `UTG` step 3 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **utgr_bbr_utgr_bb** — `BB` step 4 → {Allin / Raise / Call / Fold}
    │   │   │   ├─ raise → **utgr_bbr_utgr_bbr_utg** — `UTG` step 5 → {Allin / Call / Fold}
    │   │   │   │   ├─ allin → **utgr_bbr_utgr_bbr_utgai_bb** — `BB` step 6 → {Call / Fold} **(leaf)**
    │   │   │   │   └─ call → flop
    │   │   │   ├─ allin → **utgr_bbr_utgr_bbai_utg** — `UTG` step 7 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **utgr_bbr_utgai_bb** — `BB` step 8 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   ├─ allin → **utgr_bbai_utg** — `UTG` step 9 → {Call / Fold} **(leaf)**
    │   └─ call → flop
    ├─ raise → **utgr_btn** — `BTN` step 2 → {Allin / Raise / Call / Fold}
    │   ├─ raise → **utgr_btnr_utg** — `UTG` step 3 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **utgr_btnr_utgr_btn** — `BTN` step 4 → {Allin / Raise / Call / Fold}
    │   │   │   ├─ raise → **utgr_btnr_utgr_btnr_utg** — `UTG` step 5 → {Allin / Call / Fold}
    │   │   │   │   ├─ allin → **utgr_btnr_utgr_btnr_utgai_btn** — `BTN` step 6 → {Call / Fold} **(leaf)**
    │   │   │   │   └─ call → flop
    │   │   │   ├─ allin → **utgr_btnr_utgr_btnai_utg** — `UTG` step 7 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **utgr_btnr_utgai_btn** — `BTN` step 8 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   ├─ allin → **utgr_btnai_utg** — `UTG` step 9 → {Call / Fold} **(leaf)**
    │   └─ call → flop
    ├─ raise → **utgr_co** — `CO` step 2 → {Allin / Raise / Fold}
    │   ├─ raise → **utgr_cor_utg** — `UTG` step 3 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **utgr_cor_utgr_co** — `CO` step 4 → {Allin / Raise / Call / Fold}
    │   │   │   ├─ raise → **utgr_cor_utgr_cor_utg** — `UTG` step 5 → {Allin / Call / Fold}
    │   │   │   │   ├─ allin → **utgr_cor_utgr_cor_utgai_co** — `CO` step 6 → {Call / Fold} **(leaf)**
    │   │   │   │   └─ call → flop
    │   │   │   ├─ allin → **utgr_cor_utgr_coai_utg** — `UTG` step 7 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **utgr_cor_utgai_co** — `CO` step 8 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   └─ allin → **utgr_coai_utg** — `UTG` step 9 → {Call / Fold} **(leaf)**
    ├─ raise → **utgr_hj** — `HJ` step 2 → {Allin / Raise / Fold}
    │   ├─ raise → **utgr_hjr_utg** — `UTG` step 3 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **utgr_hjr_utgr_hj** — `HJ` step 4 → {Allin / Raise / Call / Fold}
    │   │   │   ├─ raise → **utgr_hjr_utgr_hjr_utg** — `UTG` step 5 → {Allin / Call / Fold}
    │   │   │   │   ├─ allin → **utgr_hjr_utgr_hjr_utgai_hj** — `HJ` step 6 → {Call / Fold} **(leaf)**
    │   │   │   │   └─ call → flop
    │   │   │   ├─ allin → **utgr_hjr_utgr_hjai_utg** — `UTG` step 7 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **utgr_hjr_utgai_hj** — `HJ` step 8 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   └─ allin → **utgr_hjai_utg** — `UTG` step 9 → {Call / Fold} **(leaf)**
    └─ raise → **utgr_sb** — `SB` step 2 → {Allin / Raise / Call / Fold}
        ├─ raise → **utgr_sbr_utg** — `UTG` step 3 → {Allin / Raise / Call / Fold}
        │   ├─ raise → **utgr_sbr_utgr_sb** — `SB` step 4 → {Allin / Raise / Call / Fold}
        │   │   ├─ raise → **utgr_sbr_utgr_sbr_utg** — `UTG` step 5 → {Allin / Call / Fold}
        │   │   │   ├─ allin → **utgr_sbr_utgr_sbr_utgai_sb** — `SB` step 6 → {Call / Fold} **(leaf)**
        │   │   │   └─ call → flop
        │   │   ├─ allin → **utgr_sbr_utgr_sbai_utg** — `UTG` step 7 → {Call / Fold} **(leaf)**
        │   │   └─ call → flop
        │   ├─ allin → **utgr_sbr_utgai_sb** — `SB` step 8 → {Call / Fold} **(leaf)**
        │   └─ call → flop
        ├─ allin → **utgr_sbai_utg** — `UTG` step 9 → {Call / Fold} **(leaf)**
        └─ call → flop
```

## Root: `hj` (HJ open)

```
**hj** — `HJ` step 1 → {Allin / Raise / Fold}
    ├─ raise → **hjr_bb** — `BB` step 2 → {Allin / Raise / Call / Fold}
    │   ├─ raise → **hjr_bbr_hj** — `HJ` step 3 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **hjr_bbr_hjr_bb** — `BB` step 4 → {Allin / Raise / Call / Fold}
    │   │   │   ├─ raise → **hjr_bbr_hjr_bbr_hj** — `HJ` step 5 → {Allin / Call / Fold}
    │   │   │   │   ├─ allin → **hjr_bbr_hjr_bbr_hjai_bb** — `BB` step 6 → {Call / Fold} **(leaf)**
    │   │   │   │   └─ call → flop
    │   │   │   ├─ allin → **hjr_bbr_hjr_bbai_hj** — `HJ` step 5 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **hjr_bbr_hjai_bb** — `BB` step 4 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   ├─ allin → **hjr_bbai_hj** — `HJ` step 3 → {Call / Fold} **(leaf)**
    │   └─ call → flop
    ├─ raise → **hjr_btn** — `BTN` step 2 → {Allin / Raise / Call / Fold}
    │   ├─ raise → **hjr_btnr_hj** — `HJ` step 3 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **hjr_btnr_hjr_btn** — `BTN` step 4 → {Allin / Raise / Call / Fold}
    │   │   │   ├─ raise → **hjr_btnr_hjr_btnr_hj** — `HJ` step 5 → {Allin / Call / Fold}
    │   │   │   │   ├─ allin → **hjr_btnr_hjr_btnr_hjai_btn** — `BTN` step 6 → {Call / Fold} **(leaf)**
    │   │   │   │   └─ call → flop
    │   │   │   ├─ allin → **hjr_btnr_hjr_btnai_hj** — `HJ` step 5 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **hjr_btnr_hjai_btn** — `BTN` step 4 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   ├─ allin → **hjr_btnai_hj** — `HJ` step 3 → {Call / Fold} **(leaf)**
    │   └─ call → flop
    ├─ raise → **hjr_co** — `CO` step 2 → {Allin / Raise / Fold}
    │   ├─ raise → **hjr_cor_hj** — `HJ` step 3 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **hjr_cor_hjr_co** — `CO` step 4 → {Allin / Raise / Call / Fold}
    │   │   │   ├─ raise → **hjr_cor_hjr_cor_hj** — `HJ` step 5 → {Allin / Call / Fold}
    │   │   │   │   ├─ allin → **hjr_cor_hjr_cor_hjai_co** — `CO` step 6 → {Call / Fold} **(leaf)**
    │   │   │   │   └─ call → flop
    │   │   │   ├─ allin → **hjr_cor_hjr_coai_hj** — `HJ` step 5 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **hjr_cor_hjai_co** — `CO` step 4 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   └─ allin → **hjr_coai_hj** — `HJ` step 3 → {Call / Fold} **(leaf)**
    └─ raise → **hjr_sb** — `SB` step 2 → {Allin / Raise / Call / Fold}
        ├─ raise → **hjr_sbr_hj** — `HJ` step 4 → {Allin / Raise / Call / Fold}
        │   ├─ raise → **hjr_sbr_hjr_sb** — `SB` step 6 → {Allin / Raise / Call / Fold}
        │   │   ├─ raise → **hjr_sbr_hjr_sbr_hj** — `HJ` step 8 → {Allin / Call / Fold} **(leaf)**
        │   │   │   └─ allin → **hjr_sbr_hjr_sbr_hjai_sb** — `SB` step 9 → {Call / Fold} **(leaf)**
        │   │   ├─ allin → **hjr_sbr_hjr_sbai_hj** — `HJ` step 7 → {Call / Fold} **(leaf)**
        │   │   └─ call → flop
        │   ├─ allin → **hjr_sbr_hjai_sb** — `SB` step 5 → {Call / Fold} **(leaf)**
        │   └─ call → flop
        ├─ allin → **hjr_sbai_hj** — `HJ` step 3 → {Call / Fold} **(leaf)**
        └─ call → flop
```

## Root: `co` (CO open)

```
**co** — `CO` step 1 → {Raise / Fold}
    ├─ raise → **cor_bb** — `BB` step 2 → {Allin / Raise / Call / Fold}
    │   ├─ raise → **cor_bbr_co** — `CO` step 4 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **cor_bbr_cor_bb** — `BB` step 6 → {Allin / Raise / Call / Fold}
    │   │   │   ├─ raise → **cor_bbr_cor_bbr_co** — `CO` step 8 → {Allin / Call / Fold} **(leaf)**
    │   │   │   │   └─ allin → **cor_bbr_cor_bbr_coai_bb** — `BB` step 9 → {Call / Fold} **(leaf)**
    │   │   │   ├─ allin → **cor_bbr_cor_bbai_co** — `CO` step 7 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **cor_bbr_coai_bb** — `BB` step 5 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   ├─ allin → **cor_bbai_co** — `CO` step 3 → {Call / Fold} **(leaf)**
    │   └─ call → flop
    ├─ raise → **cor_btn** — `BTN` step 2 → {Allin / Raise / Call / Fold}
    │   ├─ raise → **cor_btnr_co** — `CO` step 4 → {Raise / Allin / Call / Fold}
    │   │   ├─ raise → **cor_btnr_cor_btn** — `BTN` step 4 → {Allin / Raise / Fold}
    │   │   │   ├─ raise → **cor_btnr_cor_btnr_co** — `CO` step 5 → {Allin / Raise / Fold}
    │   │   │   │   └─ allin → **cor_btnr_cor_btnr_coai_btn** — `BTN` step 6 → {Call / Fold} **(leaf)**
    │   │   │   └─ allin → **cor_btnr_cor_btnai_co** — `CO` step 5 → {Call / Fold} **(leaf)**
    │   │   ├─ allin → **cor_btnr_coai_btn** — `BTN` step 4 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   ├─ allin → **cor_btnai_co** — `CO` step 4 → {Call / Fold} **(leaf)**
    │   └─ call → flop
    └─ raise → **cor_sb** — `SB` step 2 → {Allin / Raise / Call / Fold}
        ├─ raise → **cor_sbr_co** — `CO` step 3 → {Allin / Raise / Call / Fold}
        │   ├─ raise → **cor_sbr_cor_sb** — `SB` step 4 → {Allin / Raise / Fold}
        │   │   ├─ raise → **cor_sbr_cor_sbr_co** — `CO` step 5 → {Allin / Raise / Fold}
        │   │   │   └─ allin → **cor_sbr_cor_sbr_coai_sb** — `SB` step 6 → {Call / Fold} **(leaf)**
        │   │   └─ allin → **cor_sbr_cor_sbai_co** — `CO` step 5 → {Call / Fold} **(leaf)**
        │   ├─ allin → **cor_sbr_coai_sb** — `SB` step 4 → {Call / Fold} **(leaf)**
        │   └─ call → flop
        ├─ allin → **cor_sbai_co** — `CO` step 3 → {Call / Fold} **(leaf)**
        └─ call → flop
```

## Root: `btn` (BTN open)

```
**btn** — `BTN` step 1 → {Raise / Fold}
    ├─ raise → **btnr_bb** — `BB` step 2 → {Allin / Raise / Call / Fold}
    │   ├─ raise → **btnr_bbr_btn** — `BTN` step 3 → {Allin / Raise / Fold}
    │   │   ├─ raise → **btnr_bbr_btnr_bb** — `BB` step 4 → {Allin / Call / Fold}
    │   │   │   ├─ allin → **btnr_bbr_btnr_bbai_btn** — `BTN` step 5 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   └─ allin → **btnr_bbr_btnai_bb** — `BB` step 4 → {Call / Fold} **(leaf)**
    │   ├─ allin → **btnr_bbai_btn** — `BTN` step 3 → {Call / Fold} **(leaf)**
    │   └─ call → flop
    └─ raise → **btnr_sb** — `SB` step 2 → {Allin / Raise / Call / Fold}
        ├─ raise → **btnr_sbr_btn** — `BTN` step 3 → {Allin / Raise / Call / Fold}
        │   ├─ raise → **btnr_sbr_btnr_sb** — `SB` step 4 → {Allin / Call / Fold}
        │   │   ├─ allin → **btnr_sbr_btnr_sbai_btn** — `BTN` step 5 → {Call / Fold} **(leaf)**
        │   │   └─ call → flop
        │   ├─ allin → **btnr_sbr_btnai_sb** — `SB` step 4 → {Call / Fold} **(leaf)**
        │   └─ call → flop
        ├─ allin → **btnr_sbai_btn** — `BTN` step 3 → {Call / Fold} **(leaf)**
        └─ call → flop
```

## Root: `sb` (SB open)

```
**sb** — `SB` step 1 → {Allin / Raise / Call / Fold}
    ├─ call → **sbc_bb** — `BB` step 2 → {Allin / Raise / Check}
    │   ├─ raise → **sbc_bbr_sb** — `SB` step 3 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **sbc_bbr_sbr_bb** — `BB` step 4 → {Allin / Raise / Call / Fold}
    │   │   │   ├─ raise → **sbc_bbr_sbr_bbr_sb** — `SB` step 5 → {Allin / Call / Fold}
    │   │   │   │   ├─ allin → **sbc_bbr_sbr_bbr_sbai_bb** — `BB` step 6 → {Call / Fold} **(leaf)**
    │   │   │   │   └─ call → flop
    │   │   │   ├─ allin → **sbc_bbr_sbr_bbai_sb** — `SB` step 5 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **sbc_bbr_sbai_bb** — `BB` step 4 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   ├─ allin → **sbc_bbai_sb** — `SB` step 3 → {Call / Fold} **(leaf)**
    │   └─ check → flop
    ├─ raise → **sbr_bb** — `BB` step 2 → {Allin / Raise / Call / Fold}
    │   ├─ raise → **sbr_bbr_sb** — `SB` step 3 → {Allin / Raise / Call / Fold}
    │   │   ├─ raise → **sbr_bbr_sbr_bb** — `BB` step 4 → {Allin / Call / Fold}
    │   │   │   ├─ allin → **sbr_bbr_sbr_bbai_sb** — `SB` step 5 → {Call / Fold} **(leaf)**
    │   │   │   └─ call → flop
    │   │   ├─ allin → **sbr_bbr_sbai_bb** — `BB` step 4 → {Call / Fold} **(leaf)**
    │   │   └─ call → flop
    │   ├─ allin → **sbr_bbai_sb** — `SB` step 3 → {Call / Fold} **(leaf)**
    │   └─ call → flop
    └─ allin → **sbai_bb** — `BB` step 2 → {Call / Fold} **(leaf)**
```

## ノード数の内訳

| Root | ノード数 (ファイル) | leaf 数 |
|---|---:|---:|
| `utg` | 41 | 20 |
| `hj` | 33 | 17 |
| `co` | 25 | 13 |
| `btn` | 13 | 6 |
| `sb` | 16 | 8 |
| **合計** | **128** | **64** |

