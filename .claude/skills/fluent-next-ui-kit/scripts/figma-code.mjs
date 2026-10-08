#!/usr/bin/env node
// Fills a scripts/figma/*.js template and prints the code to pass to figma_execute as `code`.
//
//   node .claude/skills/fluent-next-ui-kit/scripts/figma-code.mjs bootstrap --file-key <key>
//   node .claude/skills/fluent-next-ui-kit/scripts/figma-code.mjs upsert    --file-key <key> --spec <spec.json> [--only <regex>]
//   node .claude/skills/fluent-next-ui-kit/scripts/figma-code.mjs audit     --file-key <key> --node <id>
//   node .claude/skills/fluent-next-ui-kit/scripts/figma-code.mjs graph     --file-key <key>
//
// --only keeps the tokens whose Figma name matches the regex (split a big widget into several calls).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [kind, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const templates = { bootstrap: 'bootstrap-collections.js', upsert: 'upsert-tokens.js', audit: 'audit-component.js', graph: 'component-graph.js' };
if (!templates[kind] || !opt('--file-key')) {
  console.error('usage: figma-code.mjs <bootstrap|upsert|audit|graph> --file-key <key> [--spec <file>] [--only <regex>] [--node <id>]');
  process.exit(2);
}
const MAIN_KIT = 'DpK8J5xUCl7Gc70DKC4I1K';
if (kind === 'upsert' && opt('--file-key') === MAIN_KIT && !rest.includes('--main')) {
  console.error('refusing to write component tokens into the main kit; work in a branch, or pass --main for the agreed bootstrap of shared tiers');
  process.exit(2);
}

let code = fs.readFileSync(path.join(here, 'figma', templates[kind]), 'utf8')
  .replace('/*@FILE_KEY@*/', opt('--file-key'));

if (kind === 'upsert') {
  if (!opt('--spec')) { console.error('--spec <file> is required'); process.exit(2); }
  const spec = JSON.parse(fs.readFileSync(path.resolve(opt('--spec')), 'utf8'));
  const only = opt('--only') ? new RegExp(opt('--only')) : null;
  const picked = spec.tokens.filter((t) => !only || only.test(t.name));
  const skipped = picked.filter((t) => t.skip);
  if (skipped.length) {
    console.error(`not included (skip - settle these edge cases first): ${skipped.map((t) => t.name).join(', ')}`);
  }
  // css is derived from the name inside the script; skipped tokens are left out to keep the code short
  const compact = {
    widget: spec.widget,
    skipped: skipped.map((t) => t.name),
    tokens: picked.filter((t) => !t.skip).map(({ name, css, collection, type, scopes, values, description }) => ({
      name,
      ...(css && css !== `--dx-${name.replace(/\//g, '-')}` ? { css } : {}),
      collection,
      type,
      scopes,
      values,
      ...(description !== undefined ? { description } : {}),
    })),
  };
  code = code.replace('/*@SPEC@*/', JSON.stringify(compact));
}
if (kind === 'audit') {
  if (!opt('--node')) { console.error('--node <id> is required'); process.exit(2); }
  code = code.replace('/*@NODE_ID@*/', opt('--node'));
}
process.stdout.write(code);
