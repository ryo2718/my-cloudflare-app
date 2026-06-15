#!/usr/bin/env node
// フロップトレーニング「中級レンジベット」用データセットを生成。
//
// 入力: data/cash_100bb_6max_nl500_2.5x/<variant>/flop_*.json (初級と同じフロップツリー)
// 出力: public/data/flop/flop_rangebet_v1.json
//
// CB問題 (複数選択, 全ポット): アグレッサーの c-bet サイズ構成。
//   ノード: アグレッサー IP→flop_<oop>_x / OOP→flop_root。選択肢 check/33/50/75/125 に集約。
//   ポット種別 SRP / 3bet / 4bet5bet (4bet+5bet を統合) でプールを分ける。混合戦略ボードのみ収録。

const fs = require('fs');
const path = require('path');

const CONFIG = 'cash_100bb_6max_nl500_2.5x';
const DATA_ROOT = path.resolve(__dirname, '..', 'data', CONFIG);
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data', 'flop');
const OUT_FILE = path.join(OUT_DIR, 'flop_rangebet_v1.json');

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']; // earlier = OOP
const OPEN_SIZE = 2.5;
const PER_VARIANT_CAP = 120; // variant (matchup) ごとの最大ボード数 (既定)。全 matchup を均等収録し hero 偏りを防ぐ

// variant 別ボード数 = プリフロップの現実到達確率 (reach) に比例させる。
//   一律120だと「現実に稀な局面」が過剰出題になる (例: SB がオープンをフラットコール、深い 4bet/5bet)。
//   reach = 各意思決定ノード (public/data/preflop/.../<line>.json) の combo 加重頻度を連鎖した積。
//   方針 = 「オープナー均等維持」: 各 (元オープナー × pot × Blind有無) グループの合計件数は維持し、
//   グループ内の 3bettor/caller 配分のみ reach 比で再配分・四捨五入。floor=20 で最薄局面の
//   ボード多様性を確保 (各ノードは全1755flopを保持)。値は scripts の reach 計算で算出 (本コメント参照)。
//   ※キー = variant 名。cb/donk/bmcb は同一プリフロップ局面なので同じ cap を適用 (kind 非依存)。
const VARIANT_CAP = {
  // SRP
  'btnr_bbc': 220, 'btnr_sbc': 20, 'cor_bbc': 263, 'cor_btnc': 69, 'cor_sbc': 28,
  'hjr_bbc': 250, 'hjr_btnc': 68, 'hjr_sbc': 42, 'sbc_bbr3_sbc': 37, 'sbc_bbr5_sbc': 37,
  'sbr_bbc': 286, 'utgr_bbc': 226, 'utgr_btnc': 89, 'utgr_sbc': 45,
  // 3bet
  'btnr_bbr_btnc': 112, 'btnr_sbr_btnc': 128, 'cor_bbr_coc': 101, 'cor_btnr_coc': 159,
  'cor_sbr_coc': 100, 'hjr_bbr_hjc': 77, 'hjr_btnr_hjc': 148, 'hjr_cor_hjc': 135,
  'sbc_bbr3_sbr14_bbc': 53, 'sbc_bbr5_sbr18_bbc': 53, 'sbr_bbr_sbc': 254, 'utgr_bbr_utgc': 71,
  'utgr_btnr_utgc': 141, 'utgr_cor_utgc': 141, 'utgr_hjr_utgc': 151, 'utgr_sbr_utgc': 96,
  // 4bet
  'btnr_bbr_btnr27_bbc': 84, 'btnr_sbr_btnr26_sbc': 156, 'cor_bbr_cor27_bbc': 48,
  'cor_btnr_cor22_btnc': 227, 'cor_sbr_cor24_sbc': 85, 'hjr_bbr_hjr24_bbc': 20,
  'hjr_btnr_hjr20_btnc': 149, 'hjr_cor_hjr20_coc': 191, 'sbc_bbr3_sbr14_bbr27_sbc': 20,
  'sbr_bbr_sbr21_bbc': 220, 'utgr_bbr_utgr22_bbc': 33, 'utgr_btnr_utgr20_btnc': 131,
  'utgr_cor_utgr20_coc': 191, 'utgr_hjr_utgr20_hjc': 182, 'utgr_sbr_utgr21_sbc': 63,
  // 5bet
  'cor_sbr_cor24_sbr40_coc': 120, 'hjr_sbr_hjr_sbr_hjc': 120,
  'utgr_bbr_utgr_bbr34_utgc': 115, 'utgr_sbr_utgr_sbr40_utgc': 125,
};

/** meta (variant/hero/villain/pot/kind) からボード収録上限を返す。variant 別 reach キャップ (無ければ既定)。 */
function capForMeta(meta) {
  const cap = VARIANT_CAP[meta.variant];
  return cap != null ? cap : PER_VARIANT_CAP;
}
const MIXED_MIN = 0.1; // CB「混合戦略」判定: この頻度以上のバケットが2つ以上

// CB問題の選択肢 (全ポット共通の上位集合)。125 = オーバーベット, ALLIN = オールイン。
// 実際に表示する選択肢はポット別 (cb_choices_by_pot) に出し分ける。
const CB_CHOICES = ['check', '33', '50', '75', '125', 'ALLIN'];
// ポット別選択肢の正準順 (check → 小 → 大 → ALLIN)。実データに出現したバケットのみ採用。
const BUCKET_ORDER = ['check', '33', '50', '75', '125', 'ALLIN'];
const POT_ORDER = ['SRP', '3bet', '4bet', '5bet'];
const CHOICE_MIN = 0.02; // この頻度以上で出現したバケットのみ選択肢に出す (微小頻度の幻バケットを除外)

function parseVariant(name) {
  const seq = [];
  for (const tok of name.split('_')) {
    const pos = POSITIONS.find((p) => tok.toUpperCase().startsWith(p));
    if (!pos) return null;
    const act = tok.slice(pos.length)[0];
    if (act !== 'r' && act !== 'c') return null;
    seq.push({ pos, act });
  }
  return seq;
}

/** seq → { potCat, pot, aggressor, defender }。potCat = 出題プールのキー。 */
function classify(name) {
  const seq = parseVariant(name);
  if (!seq) return null;
  const raises = seq.filter((s) => s.act === 'r');
  const last = seq[seq.length - 1];
  if (raises.length < 1 || last.act !== 'c') return null;
  const aggressor = raises[raises.length - 1].pos;
  const defender = last.pos;
  let pot, potCat;
  if (raises.length === 1) { pot = 'SRP'; potCat = 'SRP'; }
  else if (raises.length === 2) { pot = '3bet'; potCat = '3bet'; }
  else if (raises.length === 3) { pot = '4bet'; potCat = '4bet5bet'; }
  else if (raises.length === 4) { pot = '5bet'; potCat = '4bet5bet'; }
  else return null;
  return { pot, potCat, aggressor, defender };
}

function roles(aggressor, defender) {
  const oop = POSTFLOP_ORDER.indexOf(aggressor) < POSTFLOP_ORDER.indexOf(defender) ? aggressor : defender;
  return { oop, aggressorRole: oop === aggressor ? 'OOP' : 'IP' };
}

function loadNode(variant, file) {
  const fp = path.join(DATA_ROOT, variant, file);
  return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null;
}

/** ノードのゲーム状態から pos の preflop 投入額 (= 100 - 残スタック)。無ければ null。 */
function investedFrom(node, pos) {
  const players = node?.game_point?.game?.players ?? [];
  const p = players.find((x) => x.position === pos);
  return p ? Number((100 - parseFloat(p.current_stack)).toFixed(1)) : null;
}

/**
 * 3bet サイズの参照表 (key=`{opener}>{3bettor}` → bb)。
 * 3bet-call ライン (3bettor の最終投入 = 3bet サイズ) から作る。4bet/5bet ラインでも
 * 3bet サイズは同じ matchup で一定なので、ここを参照して実額を表示する。
 */
function buildThreeBetSizes(variants) {
  const map = {};
  for (const variant of variants) {
    const cls = classify(variant);
    if (!cls || cls.pot !== '3bet') continue; // aggressor=3bettor, defender=opener
    const size = investedFrom(loadNode(variant, 'flop_root.json'), cls.aggressor);
    if (size != null) map[`${cls.defender}>${cls.aggressor}`] = size;
  }
  return map;
}

/** sizePct(整数) を最も近いアンカーに寄せる (同点は大きい方)。 */
function nearestAnchor(pct, anchors) {
  let best = anchors[0];
  let bestD = Infinity;
  for (const a of anchors) {
    const d = Math.abs(pct - a);
    if (d < bestD || (d === bestD && a > best)) { best = a; bestD = d; }
  }
  return String(best);
}

/** action_code を CB バケット (33/50/75/125) に寄せる。RAI→ALLIN (オールイン)。X はここでは扱わない。 */
function bucketSrp(code, pot) {
  if (code === 'RAI') return 'ALLIN';
  if (code[0] !== 'R') return null;
  const n = parseFloat(code.slice(1));
  if (!Number.isFinite(n) || !pot) return null;
  return nearestAnchor(Math.round((n / pot) * 100), [33, 50, 75, 125]);
}

/** CB ノードの action_solutions → バケット別頻度 (0..1)。pot = 実際のフロップポット。 */
function bucketize(actions, pot) {
  const strat = {};
  for (const label of CB_CHOICES) strat[label] = 0;
  for (const a of actions) {
    if (a.action_code === 'F' || a.action_code === 'C') continue;
    if (a.action_code === 'X') { strat.check += a.frequency; continue; }
    if (Math.round(a.frequency * 100) <= 0) continue;
    const b = bucketSrp(a.action_code, pot);
    if (b == null) continue;
    strat[b] += a.frequency;
  }
  for (const k of Object.keys(strat)) strat[k] = Number(strat[k].toFixed(4));
  return strat;
}

/** 混合戦略か (MIXED_MIN 以上のバケットが2つ以上)。 */
function isMixed(strat) {
  let n = 0;
  for (const v of Object.values(strat)) if (v >= MIXED_MIN) n++;
  return n >= 2;
}

// --- high-card 層化抽出 (ローボード偏り対策) ---------------------------------
// 従来は「低→高ソート済み solutions の先頭 PER_VARIANT_CAP 件」を採用していたため、
// 各 variant の最低ボードだけが残りハイカードに到達しなかった。high-card で層化し
// ラウンドロビンに抽出することで、A〜2 のテクスチャを満遍なく収録する。
const RANK_VAL = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
/** ボード文字列 "AsKd2c" の最大ランク値 (A=14 … 2=2)。 */
function boardHighRank(name) {
  return Math.max(RANK_VAL[name[0]], RANK_VAL[name[2]], RANK_VAL[name[4]]);
}
/** 文字列 → 32bit seed (FNV-1a)。 */
function strSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
/** 決定的 PRNG (mulberry32)。再現性のためビルドは固定シードで回す。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleSeeded(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
/**
 * high-card で層化して cap 件をラウンドロビン抽出する。
 *   - 各 high-card ビンから1枚ずつ均等に取り、枯れたビンはスキップ。
 *   - 残り枠はボードの多いビン (主にハイカード) で埋める。
 *   - ビン内はシード付きシャッフルで偏りを避ける (決定的)。
 *   - entries が cap 以下ならそのまま全件返す。
 */
function stratifiedByHighCard(entries, cap, seed) {
  if (entries.length <= cap) return entries;
  const rand = mulberry32(seed);
  const bins = new Map();
  for (const e of entries) {
    const r = boardHighRank(e.board);
    if (!bins.has(r)) bins.set(r, []);
    bins.get(r).push(e);
  }
  // 高ランク→低ランク順のビン配列。各ビン内はシャッフル。
  const binArrs = [...bins.keys()].sort((a, b) => b - a).map((r) => shuffleSeeded(bins.get(r), rand));
  const picked = [];
  const idx = new Array(binArrs.length).fill(0);
  let progress = true;
  while (picked.length < cap && progress) {
    progress = false;
    for (let i = 0; i < binArrs.length && picked.length < cap; i++) {
      if (idx[i] < binArrs[i].length) {
        picked.push(binArrs[i][idx[i]++]);
        progress = true;
      }
    }
  }
  return picked;
}

/** プリフロップ アクション列 (アニメ用)。folds を席順で割り込ませ、raise 額は invested / 3bet表 から決定。 */
function buildPreflopSeq(variant, node, threeBetSizes = {}) {
  const players = node?.game_point?.game?.players ?? [];
  const investedOf = (pos) => {
    const p = players.find((x) => x.position === pos);
    return p ? Number((100 - parseFloat(p.current_stack)).toFixed(2)) : 0;
  };
  const toks = [];
  for (const t of variant.split('_')) {
    const pos = POSITIONS.find((p) => t.toUpperCase().startsWith(p));
    if (!pos) return [];
    const rest = t.slice(pos.length);
    const num = parseFloat(rest.slice(1));
    toks.push({ pos, act: rest[0], num: Number.isFinite(num) ? num : null });
  }
  const chain = [];
  let prev = 0;
  for (const tk of toks) {
    if (tk.act === 'r') {
      let amt = tk.num != null ? tk.num : prev === 0 ? OPEN_SIZE : null;
      chain.push({ position: tk.pos, kind: 'raise', amount: amt });
      if (amt != null) prev = amt;
    } else if (tk.act === 'c') {
      chain.push({ position: tk.pos, kind: 'call' });
    }
  }
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i];
    if (c.kind === 'raise' && c.amount == null) {
      const laterSame = chain.slice(i + 1).some((x) => x.position === c.position);
      const laterRaise = chain.slice(i + 1).some((x) => x.kind === 'raise');
      if (!laterSame && !laterRaise) c.amount = investedOf(c.position);
      else {
        // 後で再度動く中間レイズ (4bet ライン中の 3bet) は最終 invested から実額が取れないが、
        // 3bet サイズは同 matchup で一定なので 3bet表 から実額を引く。無ければ直前レベルの約3倍で近似。
        const opener = chain[0] ? chain[0].position : null;
        const fromTable = opener ? threeBetSizes[`${opener}>${c.position}`] : null;
        const prevAmt = i > 0 ? chain[i - 1].amount ?? OPEN_SIZE : OPEN_SIZE;
        c.amount = fromTable != null ? fromTable : Number((prevAmt * 3).toFixed(1));
      }
    }
  }
  // チェーン (raise/call の時系列) に各座席の fold を席順で割り込ませる。
  // 降りる席 = chain に出てこない席。オープン前に降りる席は先頭 (= 即表示)、レイザー以降に
  // 降りる席 (例: BTN open に対する SB) はその raise の後に並ぶ。全員先頭 fold だと
  // 「SB が BTN より先に降りる」ように見えるのを防ぐ。
  const inChain = new Set(chain.map((c) => c.position));
  const folded = new Set();
  const seq = [];
  let idx = 0;
  let guard = 0;
  for (let seat = 0; idx < chain.length && guard < 200; seat++, guard++) {
    const pos = POSITIONS[seat % POSITIONS.length];
    if (folded.has(pos)) continue;
    if (chain[idx].position === pos) { seq.push(chain[idx]); idx++; continue; }
    if (inChain.has(pos)) continue; // 参加者は降りない (席順で後で行動 / 既に行動済み)
    folded.add(pos);
    seq.push({ position: pos, kind: 'fold' });
  }
  return seq;
}

/**
 * ポット別の表示選択肢を実データから導出。各ポットで CHOICE_MIN 以上の頻度を持つ
 * バケットだけ採用 (check は常に含む)。例: 4bet は 125 が実在しない→[check,33,50,75,ALLIN]、
 * 5bet は 75/125 も無い→[check,33,50,ALLIN]。SRP/3bet は 125 オーバーベットが実在。
 */
function computeChoicesByPot(pools) {
  const present = {};
  for (const pool of pools) {
    for (const b of pool) {
      const set = present[b.pot] ?? (present[b.pot] = new Set());
      for (const [k, v] of Object.entries(b.strat)) if (v >= CHOICE_MIN) set.add(k);
    }
  }
  const out = {};
  for (const pot of POT_ORDER) {
    const set = present[pot];
    if (!set) continue;
    out[pot] = BUCKET_ORDER.filter((k) => k === 'check' || set.has(k));
  }
  return out;
}

function main() {
  if (!fs.existsSync(DATA_ROOT)) {
    console.error(`Missing flop tree data: ${DATA_ROOT} (R2 mirror 必要)`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const variants = fs.readdirSync(DATA_ROOT).filter((d) => fs.statSync(path.join(DATA_ROOT, d)).isDirectory());
  const threeBetSizes = buildThreeBetSizes(variants); // 4bet ライン中の 3bet 実額参照用

  const cb = { SRP: [], '3bet': [], '4bet5bet': [] }; // CB問題 (ポット別, 複数選択)
  const donk = []; // ドンク (OOP ディフェンダーが flop_root で先にリード)
  const bmcb = []; // BMCB (アグレッサーがチェック後、IP ディフェンダーがスタブ)
  const preflop = {};

  // ノードの混合戦略ボードを out に収集 (kind/hero/villain を付与)。
  //   全混合戦略ボードを集めてから high-card 層化抽出で capForMeta 件に絞る
  //   (従来は低→高ソート済み solutions の先頭 cap 件 = ローボード偏りの原因)。
  const collectBoards = (out, node, meta) => {
    if (!node) return;
    const flopPot = node.game_point?.game?.pot ?? 0;
    const mixed = [];
    for (const s of node.solutions) {
      const strat = bucketize(s.action_solutions, flopPot);
      if (!isMixed(strat)) continue;
      mixed.push({ variant: meta.variant, hero: meta.hero, villain: meta.villain, pot: meta.pot, kind: meta.kind, board: s.name, strat });
    }
    const seed = strSeed(`${meta.variant}|${meta.kind}`);
    for (const e of stratifiedByHighCard(mixed, capForMeta(meta), seed)) out.push(e);
  };

  for (const variant of variants) {
    const cls = classify(variant);
    if (!cls) continue;
    const { pot, potCat, aggressor, defender } = cls;
    const { oop, aggressorRole } = roles(aggressor, defender);
    preflop[variant] = buildPreflopSeq(variant, loadNode(variant, 'flop_root.json'), threeBetSizes);

    // CB問題: 全ポット。アグレッサーの c-bet ノード。hero=アグレッサー / villain=ディフェンダー。
    //   アグレッサー OOP→flop_root / IP→flop_<oop>_x (OOP チェック後の局面)。
    const pool = cb[potCat];
    if (pool) {
      const cbFile = aggressorRole === 'OOP' ? 'flop_root.json' : `flop_${oop.toLowerCase()}_x.json`;
      collectBoards(pool, loadNode(variant, cbFile), { variant, hero: aggressor, villain: defender, pot, kind: 'cb' });
    }

    // ドンク: アグレッサーが IP のとき、OOP ディフェンダーが flop_root で先にリードする局面。
    //   hero=ディフェンダー(OOP) / villain=アグレッサー(IP)。
    if (aggressorRole === 'IP') {
      collectBoards(donk, loadNode(variant, 'flop_root.json'), { variant, hero: defender, villain: aggressor, pot, kind: 'donk' });
    }
    // BMCB: アグレッサーが OOP でチェック (flop_<oop>_x) → IP ディフェンダーがスタブする局面。
    //   hero=ディフェンダー(IP) / villain=アグレッサー(OOP, チェック済)。
    if (aggressorRole === 'OOP') {
      collectBoards(bmcb, loadNode(variant, `flop_${oop.toLowerCase()}_x.json`), { variant, hero: defender, villain: aggressor, pot, kind: 'bmcb' });
    }
  }

  const cbChoicesByPot = computeChoicesByPot([...Object.values(cb), donk, bmcb]);

  const out = {
    config: CONFIG,
    generated_at: new Date().toISOString(),
    note: 'Flop range-bet. cb=aggressor c-bet, donk=OOP lead, bmcb=IP stab vs missed c-bet. RAI=ALLIN.',
    cb_choices: CB_CHOICES,
    cb_choices_by_pot: cbChoicesByPot,
    preflop,
    cb,
    donk,
    bmcb,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  const byPot = (arr) => ['SRP', '3bet', '4bet', '5bet'].map((p) => `${p}:${arr.filter((b) => b.pot === p).length}`).join(' ');
  console.log('CB SRP      :', cb.SRP.length);
  console.log('CB 3bet     :', cb['3bet'].length);
  console.log('CB 4bet5bet :', cb['4bet5bet'].length, '(4bet/5bet)');
  console.log('DONK        :', donk.length, '(', byPot(donk), ')');
  console.log('BMCB        :', bmcb.length, '(', byPot(bmcb), ')');
  console.log('choices/pot :', JSON.stringify(cbChoicesByPot));
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)}KB)`);
}

main();
