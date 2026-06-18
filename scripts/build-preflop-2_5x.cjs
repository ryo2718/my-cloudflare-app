#!/usr/bin/env node
// Convert legacy 2.5x preflop data into the new action-chain format (gto と同一)。
// 旧 public/data/preflop/cash_100bb_6max_nl500_2.5x/<node_path>.json は action_history が
// 手番順を失っている (hero 以外を席順で全 fold padding) ため衝突する。代わりに
// node_path (= 真の手番を保持) からアクション列を復元し、プリフロップの正しい
// ベッティング順をシミュレートして連鎖を生成する。
//
// 出力: dist-preflop-data/v1/cash_100bb_6max_nl500_2_5x/{by_chain/<stem>.json, index.json}
// 旧 public データは削除しない (training 依存)。決定的。
//
// Usage: node scripts/build-preflop-2_5x.cjs   (npm run build:preflop-2_5x)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'data', 'preflop', 'cash_100bb_6max_nl500_2.5x');
const OUT_CONFIG = 'cash_100bb_6max_nl500_2_5x';
const OUT_DIR = path.join(ROOT, 'dist-preflop-data', 'v1', OUT_CONFIG);
const SEAT = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const ABBR = { utg: 'UTG', hj: 'HJ', co: 'CO', btn: 'BTN', sb: 'SB', bb: 'BB' };
const STACK = 100;

function r2(x) {
  return x == null ? 0 : Math.round(x * 100) / 100;
}
function chainToStem(chain) {
  return chain ? chain.replace(/-/g, '_').replace(/\./g, '_') : 'root';
}

// node_path -> [{pos, act}] (act: 'r'|'c'|'ai'|undefined(hero))。
function parsePath(np) {
  const out = [];
  for (const seg of np.split('_')) {
    const m = seg.match(/^(utg|hj|co|btn|sb|bb)(r|c|ai)?$/);
    if (!m) return null;
    out.push({ pos: ABBR[m[1]], act: m[2] });
  }
  return out;
}

// 正しいベッティング順で連鎖を復元。voluntary を node_path 順に、folds は補完。
function deriveChain(np, actionHistory) {
  const acts = parsePath(np);
  if (!acts) return null;
  const hero = acts[acts.length - 1].pos;
  const voluntary = acts.filter((a) => a.act);
  // aggressive sizes (Raise/Allin) を action_history 順に。
  const aggro = actionHistory
    .filter((e) => e.action.startsWith('Raise') || e.action.startsWith('Allin'))
    .map((e) => e.action);

  const folded = new Set();
  const committed = { UTG: 0, HJ: 0, CO: 0, BTN: 0, SB: 0.5, BB: 1 };
  const acted = new Set();
  let bet = 1;
  let vi = 0;
  let ai = 0;
  const tokens = [];
  const next = (from) => {
    for (let k = 1; k <= 6; k++) {
      const s = SEAT[(from + k) % 6];
      if (folded.has(s)) continue;
      if (committed[s] < bet) return s;
      if (!acted.has(s)) return s;
    }
    return null;
  };
  let to = next(-1);
  for (let guard = 0; guard < 40; guard++) {
    const seat = to;
    if (seat == null) break;
    if (seat === hero && vi >= voluntary.length) break; // hero の決定ノードに到達
    if (vi < voluntary.length && voluntary[vi].pos === seat) {
      const act = voluntary[vi].act;
      vi += 1;
      if (act === 'c') {
        tokens.push('C');
        committed[seat] = bet;
        acted.add(seat);
      } else if (act === 'ai') {
        tokens.push('RAI');
        ai += 1; // consume aggressive slot
        committed[seat] = STACK;
        bet = Math.max(bet, STACK);
        acted.clear();
        acted.add(seat);
      } else {
        // raise: action_history の対応する Raise からサイズ取得
        const a = aggro[ai++] || '';
        const m = a.match(/Raise\s+(\d+(?:\.\d+)?)/);
        const size = m ? m[1] : String(bet + 1);
        tokens.push(`R${size}`);
        committed[seat] = Number(size);
        bet = Number(size);
        acted.clear();
        acted.add(seat);
      }
    } else {
      tokens.push('F');
      folded.add(seat);
      acted.add(seat);
    }
    to = next(SEAT.indexOf(seat));
  }
  const active = SEAT.filter((s) => !folded.has(s));
  return { chain: tokens.join('-'), hero, active };
}

function convertHands(rawHands) {
  const hands = {};
  for (const [hand, h] of Object.entries(rawHands)) {
    hands[hand] = {
      allin: r2(h.allin ?? 0),
      raise: r2(h.raise ?? 0),
      call: r2((h.call ?? 0) + (h.check ?? 0)),
      fold: r2(h.fold ?? 0),
      range_weight: null,
    };
  }
  return hands;
}

function tokenLabel(token) {
  if (token === 'F') return 'fold';
  if (token === 'C') return 'call';
  if (token === 'RAI') return 'all-in';
  const m = token.match(/^R(\d+(?:\.\d+)?)$/);
  return m ? `raise (${m[1]}bb)` : token;
}

function main() {
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).sort();
  const derived = []; // {stem, chain, hero, active, hands, available, np}
  const seen = new Map(); // chain -> [np]
  for (const f of files) {
    const np = f.slice(0, -5);
    const d = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
    const res = deriveChain(np, d.game_info.action_history || []);
    if (!res) {
      console.warn(`  SKIP ${np}: unparsable node_path`);
      continue;
    }
    (seen.get(res.chain) || seen.set(res.chain, []).get(res.chain)).push(np);
    derived.push({
      stem: chainToStem(res.chain),
      chain: res.chain,
      hero: res.hero,
      active: res.active,
      hands: convertHands(d.hands),
      available: d.game_info.available_actions_at_this_node || [],
      np,
    });
  }
  derived.sort((a, b) => (a.chain < b.chain ? -1 : a.chain > b.chain ? 1 : 0));

  // 衝突チェック
  const collisions = [...seen.entries()].filter(([, v]) => v.length > 1);

  const chainSet = new Set(derived.map((d) => d.chain));

  // write nodes + build index
  const byChainDir = path.join(OUT_DIR, 'by_chain');
  fs.mkdirSync(byChainDir, { recursive: true });
  // C + R<size> + (F)* の最寄り存在チェーンから raise トークン(サイズ)を解決。
  function resolveRaiseToken(chain) {
    const prefix = chain ? `${chain}-R` : 'R';
    let best = null;
    for (const c of chainSet) {
      if (!c.startsWith(prefix)) continue;
      const suffix = c.slice(chain ? chain.length + 1 : 0).split('-'); // tokens after chain
      if (!suffix[0].startsWith('R') || suffix[0] === 'RAI') continue;
      if (!suffix.slice(1).every((t) => t === 'F')) continue; // raise + folds only
      if (best === null || suffix.length < best.depth) best = { token: suffix[0], depth: suffix.length };
    }
    return best ? best.token : 'R'; // 子が無い raise はサイズ無し placeholder
  }
  // token のアクション後、最寄りの実在ノードへ (欠けた中間 fold を skip-connect)。
  function resolveTarget(chain, token) {
    let cur = chain ? `${chain}-${token}` : token;
    for (let i = 0; i <= SEAT.length; i++) {
      if (chainSet.has(cur)) return cur;
      cur = `${cur}-F`;
    }
    return null;
  }

  const nodes = {};
  for (const node of derived) {
    // actions_legend = この手番の実際の available_actions (gto と同じ「手番の選択肢」)。
    const legend = {};
    for (const a of node.available) {
      const verb = a.split(/\s+/)[0];
      if (verb === 'Fold') legend.F = tokenLabel('F');
      else if (verb === 'Call' || verb === 'Check') legend.C = tokenLabel('C');
      else if (verb === 'Allin') legend.RAI = tokenLabel('RAI');
      else if (verb === 'Raise') {
        const rt = resolveRaiseToken(node.chain);
        legend[rt] = tokenLabel(rt);
      }
    }
    if (!('F' in legend)) legend.F = tokenLabel('F');
    // index nodes[stem] = { token: 最寄り実在ノード stem } (skip-connect)。
    const map = {};
    for (const token of Object.keys(legend)) {
      const target = resolveTarget(node.chain, token);
      if (target !== null) map[token] = chainToStem(target);
    }
    nodes[node.stem] = map;
    const out = {
      _meta: { preflop_actions: node.chain, actor: node.hero.toLowerCase(), active_positions: node.active },
      game_info: {
        active_position: node.hero,
        players: SEAT.map((s) => ({ position: s, is_hero: s === node.hero, is_active: s === node.hero, is_folded: !node.active.includes(s) })),
      },
      actions_legend: legend,
      hands: node.hands,
    };
    fs.writeFileSync(path.join(byChainDir, `${node.stem}.json`), JSON.stringify(out));
  }

  // entries (position -> shortest chain where that pos is hero)
  const best = {};
  for (const node of derived) {
    const pos = node.hero;
    const depth = node.chain ? node.chain.split('-').length : 0;
    const cur = best[pos];
    if (!cur || depth < cur.depth || (depth === cur.depth && node.chain < cur.chain)) best[pos] = { depth, chain: node.chain };
  }
  const entries = {};
  for (const pos of SEAT) if (best[pos]) entries[pos] = chainToStem(best[pos].chain);

  const index = {
    config: OUT_CONFIG, label: '100bb NL500 2.5x', stackBb: 100, rake: 'NL500', openSize: '2.5x',
    positionOrder: SEAT, entries, nodes,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index));

  // connectivity: BFS from entries over the token->target graph (skip-connect 込み)。
  const reachable = new Set();
  const stack = Object.values(entries);
  while (stack.length) {
    const n = stack.pop();
    if (reachable.has(n) || !(n in nodes)) continue;
    reachable.add(n);
    for (const c of Object.values(nodes[n])) stack.push(c);
  }
  const unreachable = Object.keys(nodes).filter((n) => !reachable.has(n));

  console.log(`${OUT_CONFIG}: ${derived.length} nodes -> ${path.relative(ROOT, OUT_DIR)}/`);
  console.log(`  collisions: ${collisions.length}`, collisions.slice(0, 5).map(([c, v]) => `${c}=${v.join(',')}`));
  console.log(`  reachable from root: ${reachable.size}/${Object.keys(nodes).length}, unreachable: ${unreachable.length}`, unreachable.slice(0, 10));
}

main();
