#!/usr/bin/env node
// Auto-generate the flop variants manifest from data/cash_<config>/.
// Output: src/data/flopVariantsManifest.ts
//
// Each top-level subdirectory of data/cash_<config>/ is one flop variant
// (preflop chain that ended in a call → flop). Phase 2 supports a single
// config; multi-config support is a future extension.
//
// Regenerate with: node scripts/generate-flop-manifest.cjs

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, '..', 'data');
const OUTPUT = path.resolve(__dirname, '..', 'src', 'data', 'flopVariantsManifest.ts');

function findConfigDirs() {
  if (!fs.existsSync(DATA_ROOT)) {
    console.error(`Error: ${DATA_ROOT} does not exist.`);
    console.error('Flop data must live at data/cash_<config>/<variant>/flop_*.json');
    process.exit(1);
  }
  return fs
    .readdirSync(DATA_ROOT)
    .filter((d) => d.startsWith('cash_'))
    .filter((d) => fs.statSync(path.join(DATA_ROOT, d)).isDirectory())
    .sort();
}

function collectVariants(configDir) {
  const full = path.join(DATA_ROOT, configDir);
  return fs
    .readdirSync(full)
    .filter((v) => fs.statSync(path.join(full, v)).isDirectory())
    .sort();
}

function main() {
  const configs = findConfigDirs();
  if (configs.length === 0) {
    console.error(`Error: no cash_* directories found in ${DATA_ROOT}`);
    process.exit(1);
  }
  if (configs.length > 1) {
    console.warn(`Multiple configs found (${configs.join(', ')}); Phase 2 uses ${configs[0]}.`);
  }
  const config = configs[0];
  const variants = collectVariants(config);
  if (variants.length === 0) {
    console.error(`Error: no variant directories under data/${config}/`);
    process.exit(1);
  }

  const lines = [
    '// AUTO-GENERATED. Do not edit by hand.',
    `// Source: data/${config}/<variant>/`,
    '// Regenerate with: node scripts/generate-flop-manifest.cjs',
    '',
    `export const FLOP_CONFIG = '${config}' as const;`,
    '',
    '/** All flop variant directory names available in the dataset. */',
    'export const FLOP_VARIANTS: ReadonlySet<string> = new Set<string>([',
    ...variants.map((v) => `  '${v}',`),
    ']);',
    '',
  ];
  fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8');
  console.log(
    `Wrote ${variants.length} variants from ${config} → ${path.relative(process.cwd(), OUTPUT)}`,
  );
}

main();
