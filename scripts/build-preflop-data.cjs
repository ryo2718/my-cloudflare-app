#!/usr/bin/env node
// Convert the new preflop_range scraper output into the slim, R2-hosted
// delivery format (Phase 1). Mirrors the flop pipeline (scripts/build-flop-*.cjs
// + docs/FLOP_STRATEGY_TAB.md §4.1): large per-node JSON lives on Cloudflare R2,
// not in git / not in the Pages dist.
//
// Input : preflop_ranges/<config>/by_chain/<chain>.json   (raw scraper output)
// Output: dist-preflop-data/v1/<config>/by_chain/<chain>.json  (minified)
//
// Upload (manual, by user): rclone copy dist-preflop-data/v1 \
//   r2:<bucket>/data/preflop/v1 ...   (see docs/PREFLOP_STRATEGY_TAB.md)
//
// Conversion (per file):
//   - hands[H].actions_aggregated {fold, call_or_check, raise, allin} (0-1)
//       -> flat {allin, raise, call, fold} on the 0-100 scale (call_or_check -> call).
//         Keeps the existing RawStrategyFile hand shape so a Phase 2 loader can
//         reuse it; values rounded to 2 decimals (source is already 2-decimal).
//   - hands[H].evs_aggregated -> hands[H].evs {allin, raise, call, fold}
//         EV is preserved for a future Equity feature. null (action not available
//         at this node) is preserved as null. Rounded to 3 decimals.
//   - hands[H].range_weight preserved (rounded to 4 decimals).
//   - hands[H].actions / hands[H].evs (raw per-bet-size split) are dropped;
//         the aggregated values above are sufficient.
//   - top-level _meta / game_info / actions_legend / actions_aggregated_legend /
//         action_totals_aggregated preserved (breadcrumb / node metadata).
//   - top-level action_totals (raw per-bet-size split) dropped.
//
// Not copied to output: hand_index_map*.json, scrape_report*.json,
//   phase3_calibration_*.json, raw/, raw_verify/, by_chain_phase3/,
//   multiway_dropped/, convert/, *.log, *.md, .DS_Store, loose dirs.
//   Only <config>/by_chain/*.json is read.
//
// Deterministic: same input -> same output (sorted files, stable key order,
// fixed rounding). Single-threaded; full run (~9.7k files) is ~10s.
//
// Usage:
//   node scripts/build-preflop-data.cjs                  # all configs
//   node scripts/build-preflop-data.cjs cash_20bb_6max_nl500_gto [...]  # subset

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(ROOT, 'preflop_ranges');
const OUT_ROOT = path.join(ROOT, 'dist-preflop-data', 'v1');

function r2(x) {
  // round to 2 decimals on the 0-100 scale
  if (x == null) return 0;
  return Math.round(x * 100 * 100) / 100;
}
function r3(x) {
  if (x == null) return null;
  return Math.round(x * 1000) / 1000;
}
function r4(x) {
  if (x == null) return null;
  return Math.round(x * 10000) / 10000;
}

function convertFile(raw) {
  const hands = {};
  for (const [hand, v] of Object.entries(raw.hands)) {
    const a = v.actions_aggregated || {};
    const e = v.evs_aggregated || {};
    hands[hand] = {
      allin: r2(a.allin),
      raise: r2(a.raise),
      call: r2(a.call_or_check),
      fold: r2(a.fold),
      range_weight: r4(v.range_weight),
      evs: {
        allin: r3(e.allin),
        raise: r3(e.raise),
        call: r3(e.call_or_check),
        fold: r3(e.fold),
      },
    };
  }
  return {
    _meta: raw._meta,
    game_info: raw.game_info,
    actions_legend: raw.actions_legend,
    actions_aggregated_legend: raw.actions_aggregated_legend,
    action_totals_aggregated: raw.action_totals_aggregated,
    hands,
  };
}

function listConfigs() {
  if (!fs.existsSync(SRC_ROOT)) {
    console.error(`Error: ${SRC_ROOT} does not exist.`);
    console.error('New preflop data must live at preflop_ranges/<config>/by_chain/<chain>.json');
    process.exit(1);
  }
  return fs
    .readdirSync(SRC_ROOT)
    .filter((d) => d.startsWith('cash_'))
    .filter((d) => fs.statSync(path.join(SRC_ROOT, d)).isDirectory())
    .sort();
}

function processConfig(config) {
  const inDir = path.join(SRC_ROOT, config, 'by_chain');
  if (!fs.existsSync(inDir)) {
    console.warn(`  SKIP ${config}: no by_chain/ directory (no production data)`);
    return { files: 0, bytes: 0 };
  }
  const outDir = path.join(OUT_ROOT, config, 'by_chain');
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs
    .readdirSync(inDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  let bytes = 0;
  let written = 0;
  let skipped = 0;
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8'));
    // Some by_chain files are a different raw schema (action_solutions / players_info,
    // no aggregated `hands`). Skip them rather than guess at a conversion.
    if (!raw || typeof raw.hands !== 'object' || raw.hands === null) {
      skipped += 1;
      continue;
    }
    const out = JSON.stringify(convertFile(raw));
    fs.writeFileSync(path.join(outDir, f), out);
    bytes += Buffer.byteLength(out);
    written += 1;
  }
  const note = skipped ? ` (skipped ${skipped} non-standard)` : '';
  console.log(`  ${config}: ${written} files, ${(bytes / 1e6).toFixed(1)} MB${note}`);
  return { files: written, bytes };
}

function main() {
  const requested = process.argv.slice(2);
  const all = listConfigs();
  const configs = requested.length
    ? requested.filter((c) => {
        if (!all.includes(c)) {
          console.error(`Error: unknown config "${c}". Available: ${all.join(', ')}`);
          process.exit(1);
        }
        return true;
      })
    : all;

  console.log(`Converting ${configs.length} config(s) -> ${path.relative(ROOT, OUT_ROOT)}/`);
  let totFiles = 0;
  let totBytes = 0;
  for (const c of configs) {
    const r = processConfig(c);
    totFiles += r.files;
    totBytes += r.bytes;
  }
  console.log(`Done: ${totFiles} files, ${(totBytes / 1e6).toFixed(1)} MB total (minified).`);
}

main();
