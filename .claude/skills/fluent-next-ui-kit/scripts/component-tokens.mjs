#!/usr/bin/env node
// Lists the Fluent Next component tokens of one widget, with their built values and how they map to
// Figma, and writes the spec that scripts/figma/upsert-tokens.js consumes.
//
//   node .claude/skills/fluent-next-ui-kit/scripts/component-tokens.mjs <widget> [--json] [--spec <file>] [--css-dir <dir>]
//
// <widget> is a folder under packages/devextreme-scss/scss/widgets/fluent-next (button, checkBox, common,
// typography, ...), its kebab name (check-box), or `root` for the unprefixed :root tokens (--dx-font-size, ...).
//
// Sources, in order of authority:
//   names       widgets/fluent-next/<widget>/_public.scss and _public-links.scss (generated, the published tier)
//   values      the built bundles dx.fluent-next.blue.{light,light.compact,dark}.css - SCSS already resolved,
//               so a value is what the browser gets (var(--dxds-*), a link to another --dx-*, or a literal)
//   collection  where the SCSS variable is defined (_colors.scss -> theme, _sizes.scss -> size), checked
//               against the kind of value
//   unread      tools/review/unread-tier.json - published names no rule of the theme reads
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const scssRoot = path.join(repo, 'packages/devextreme-scss');
const themeDir = path.join(scssRoot, 'scss/widgets/fluent-next');

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !['--spec', '--css-dir'].includes(args[i - 1]));
const widgetArg = positional[0];
if (!widgetArg) {
  console.error('usage: component-tokens.mjs <widget> [--json] [--spec <file>] [--css-dir <dir>]');
  process.exit(2);
}

const registries = JSON.parse(fs.readFileSync(path.join(scssRoot, 'tools/naming/registries.json'), 'utf8'));
const components = registries.components; // folder -> kebab prefix
const kebabToFolder = Object.fromEntries(Object.entries(components).map(([f, k]) => [k, f]));
const systemFolders = registries.systemFolders || ['common', 'typography', 'viz'];
const systemConcerns = [...(registries.systemConcerns || [])].sort((a, b) => b.length - a.length);
const unread = new Set(JSON.parse(fs.readFileSync(path.join(scssRoot, 'tools/review/unread-tier.json'), 'utf8')).names
  .map((n) => n.replace(/^--dx-/, '')));

// --dxds names with no Foundation tokens variable (checked against the library on 2026-10-08).
// The Figma-side script is the final authority: it reports every name it cannot resolve.
const NO_FIGMA_COUNTERPART = /^(font-family-(system-|segoe-ui|inter|roboto|serif$)|text-case-|text-decoration-|icon-color-)/;

const folder = widgetArg === 'root' ? 'root' : (fs.existsSync(path.join(themeDir, widgetArg)) ? widgetArg : kebabToFolder[widgetArg]);
if (!folder) {
  console.error(`unknown widget "${widgetArg}"; expected a folder in ${path.relative(repo, themeDir)} or a kebab name`);
  process.exit(2);
}

const cssDir = opt('--css-dir') ? path.resolve(opt('--css-dir')) : [
  path.join(repo, 'apps/demos/node_modules/devextreme-dist/css'),
  path.join(repo, 'packages/devextreme/artifacts/css'),
].find((d) => fs.existsSync(path.join(d, 'dx.fluent-next.blue.light.css')));
if (!cssDir) {
  console.error('no built fluent-next bundle found; run `pnpm run demos:prepare` (or pass --css-dir)');
  process.exit(2);
}
const bundles = {
  default: 'dx.fluent-next.blue.light.css',
  compact: 'dx.fluent-next.blue.light.compact.css',
  dark: 'dx.fluent-next.blue.dark.css',
};
const css = Object.fromEntries(Object.entries(bundles).map(([k, f]) => [k, fs.readFileSync(path.join(cssDir, f), 'utf8')]));
const builtAt = fs.statSync(path.join(cssDir, bundles.default)).mtime;

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');

// ---- token names ---------------------------------------------------------------------------------
function publicTokens(dir) {
  const out = [];
  for (const m of read(path.join(themeDir, dir, '_public.scss')).matchAll(/--dx-([a-z0-9-]+):\s*#\{\$([a-z0-9-]+)\}/g)) {
    out.push({ token: m[1], scssVar: m[2] });
  }
  for (const m of read(path.join(themeDir, dir, '_public-links.scss')).matchAll(/--dx-([a-z0-9-]+):\s*var\(--dx-([a-z0-9-]+)\)/g)) {
    out.push({ token: m[1], linkTo: m[2] });
  }
  return out;
}

// every published token of the theme, to resolve links that cross widgets
const allTokens = new Map();
for (const dir of fs.readdirSync(themeDir)) {
  if (!fs.existsSync(path.join(themeDir, dir, '_public.scss'))) continue;
  for (const t of publicTokens(dir)) allTokens.set(t.token, { ...t, folder: dir });
}

let tokens;
if (folder === 'root') {
  tokens = [];
  for (const f of ['_sizes.scss', '_colors.scss']) {
    for (const m of read(path.join(themeDir, f)).matchAll(/--dx-([a-z0-9-]+):/g)) {
      tokens.push({ token: m[1], rootFile: f });
    }
  }
} else {
  tokens = publicTokens(folder);
  if (!tokens.length) {
    console.error(`${folder} publishes no tokens (no _public.scss in ${path.relative(repo, path.join(themeDir, folder))})`);
    process.exit(1);
  }
}

// ---- where an SCSS variable is defined -----------------------------------------------------------
function definedIn(dir, scssVar) {
  const re = new RegExp(`^\\$${scssVar}\\s*:`, 'm');
  if (re.test(read(path.join(themeDir, dir, '_colors.scss')))) return 'colors';
  if (re.test(read(path.join(themeDir, dir, '_sizes.scss')))) return 'sizes';
  return 'other';
}

// ---- built values and usages ---------------------------------------------------------------------
function declarations(text, token) {
  const values = new Map(); // value -> [selectors]
  const re = new RegExp(`--dx-${token}:([^;}]*)`, 'g');
  for (const m of text.matchAll(re)) {
    const value = m[1].trim();
    const open = text.lastIndexOf('{', m.index);
    const prevClose = Math.max(text.lastIndexOf('}', open), text.lastIndexOf('{', open - 1));
    const selector = text.slice(prevClose + 1, open).trim();
    if (!values.has(value)) values.set(value, []);
    values.get(value).push(selector);
  }
  return values;
}

const usageIndex = (() => {
  const idx = new Map(); // token -> Set("prop @ selector")
  for (const m of css.default.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    for (const decl of m[2].split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim();
      if (prop.startsWith('--')) continue;
      for (const v of decl.slice(i + 1).matchAll(/var\(--dx-([a-z0-9-]+)/g)) {
        if (!idx.has(v[1])) idx.set(v[1], new Set());
        idx.get(v[1]).add(`${prop} @ ${selector.length > 90 ? `${selector.slice(0, 87)}...` : selector}`);
      }
    }
  }
  return idx;
})();

function classify(raw) {
  if (raw === undefined) return { kind: 'missing' };
  let m = raw.match(/^var\(--dxds-([a-z0-9-]+)\)$/);
  if (m) return { kind: 'ds', ds: m[1] };
  m = raw.match(/^var\(--dx-([a-z0-9-]+)\)$/);
  if (m) return { kind: 'link', token: m[1] };
  if (raw === 'transparent') return { kind: 'ds', ds: 'color-none', note: 'transparent' };
  if (/^calc\(/.test(raw)) return { kind: 'literal', sub: 'calc', raw };
  if (/^color-mix\(/.test(raw) || /^rgb\(from /.test(raw)) return { kind: 'literal', sub: 'color-mix', raw };
  if (/^(normal|none|auto|inherit|initial|unset)$/.test(raw)) return { kind: 'literal', sub: 'keyword', raw };
  if (/^-?[\d.]+(px|rem|em|%)?$/.test(raw)) return { kind: 'literal', sub: 'number', raw };
  if (/^(#|rgb|hsl)/.test(raw)) return { kind: 'literal', sub: 'color', raw };
  return { kind: 'literal', sub: 'other', raw };
}

// ---- naming ---------------------------------------------------------------------------------------
function figmaName(token) {
  const own = components[folder];
  if (own && token.startsWith(`${own}-`)) return `${own}/${token.slice(own.length + 1)}`;
  const comp = Object.values(components).sort((a, b) => b.length - a.length).find((k) => token.startsWith(`${k}-`));
  if (comp) return `${comp}/${token.slice(comp.length + 1)}`;
  const concern = systemConcerns.find((c) => token.startsWith(`${c}-`));
  if (concern) return `${concern}/${token.slice(concern.length + 1)}`;
  return token; // unprefixed :root token, stays ungrouped
}

const COLOR_DS = /^(color-|primary-|secondary-|info-|success-|warning-|danger-|neutral-|gray-|blue-|cyan-|teal-|green-|yellow-|orange-|red-|pink-|purple-|indigo-|global-color-|icon-color-|box-shadow-layer-\d-color-)/;

function figmaType(v) {
  if (!v) return undefined;
  if (v.kind === 'ds') {
    if (COLOR_DS.test(v.ds)) return 'COLOR';
    if (/^font-family-|^icon-set$|^text-case-|^text-decoration-/.test(v.ds)) return 'STRING';
    if (/^box-shadow-(none|xs|sm|md|lg|xl|2xl)$/.test(v.ds)) return 'EFFECT';
    return 'FLOAT';
  }
  if (v.kind === 'literal') {
    if (v.sub === 'color' || v.sub === 'color-mix') return 'COLOR';
    if (v.sub === 'number' || v.sub === 'calc') return 'FLOAT';
  }
  return undefined;
}

// Scopes are filtered by the variable type afterwards, so a shorthand may offer both a colour and a
// number scope and the type keeps the one that fits.
const SCOPE_BY_PROP = [
  [/^background(-color)?$/, ['FRAME_FILL', 'SHAPE_FILL']],
  [/^(color|fill)$/, ['TEXT_FILL', 'SHAPE_FILL']],
  [/^(border(-[a-z-]+)?-color|outline-color|stroke|caret-color|text-decoration-color)$/, ['STROKE_COLOR']],
  [/^(border|outline)(-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?$/, ['STROKE_FLOAT', 'STROKE_COLOR']],
  [/^box-shadow$/, ['EFFECT_COLOR']],
  [/^(padding|margin|gap|row-gap|column-gap|outline-offset|inset)(-[a-z-]+)?$/, ['GAP']],
  [/^((min-|max-)?(width|height|inline-size|block-size)|flex-basis|top|right|bottom|left)$/, ['WIDTH_HEIGHT']],
  [/radius$/, ['CORNER_RADIUS']],
  [/^(border(-[a-z-]+)?-width|outline-width)$/, ['STROKE_FLOAT']],
  [/^font-size$/, ['FONT_SIZE']],
  [/^font-weight$/, ['FONT_WEIGHT']],
  [/^line-height$/, ['LINE_HEIGHT']],
  [/^letter-spacing$/, ['LETTER_SPACING']],
  [/^font-family$/, ['FONT_FAMILY']],
  [/^opacity$/, ['OPACITY']],
];
// first match wins: the specific endings before the generic size/spacing ones
const SCOPE_BY_NAME = [
  [/(^|-)font-size(-|$)/, ['FONT_SIZE']],
  [/(^|-)font-weight$/, ['FONT_WEIGHT']],
  [/(^|-)line-height$/, ['LINE_HEIGHT']],
  [/(^|-)letter-spacing$/, ['LETTER_SPACING']],
  [/(^|-)font-family$/, ['FONT_FAMILY']],
  [/(^|-)(border-|outline-)?radius$/, ['CORNER_RADIUS']],
  [/(^|-)(border|outline)(-[a-z]+)?-width$|^border-width$/, ['STROKE_FLOAT']],
  [/-bg$|-bg-|-backdrop|(^|-)bg$/, ['FRAME_FILL', 'SHAPE_FILL']],
  [/-border(-|$)|-outline$|-separator$/, ['STROKE_COLOR']],
  [/-(content|text|icon|placeholder|caption|title|subtitle)(-|$)|^color-/, ['TEXT_FILL', 'SHAPE_FILL']],
  [/(padding|margin|gap|offset|spacing)/, ['GAP']],
  [/(height|width|size)$/, ['WIDTH_HEIGHT']],
];

function scopesFor(token, usages, type) {
  // a scope must fit the variable type: drop what Figma would reject
  const colorScopes = new Set(['ALL_FILLS', 'FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR', 'EFFECT_COLOR']);
  const fit = (list) => list.filter((s) => (type === 'COLOR' ? colorScopes.has(s) : type === 'STRING' ? ['FONT_FAMILY', 'FONT_STYLE', 'TEXT_CONTENT'].includes(s) : !colorScopes.has(s) && s !== 'FONT_FAMILY'));
  const fromUsage = new Set();
  for (const u of usages) {
    const prop = u.split(' @ ')[0];
    for (const [re, sc] of SCOPE_BY_PROP) if (re.test(prop)) sc.forEach((s) => fromUsage.add(s));
  }
  const byUsage = fit([...fromUsage]);
  if (byUsage.length) return byUsage;
  for (const [re, sc] of SCOPE_BY_NAME) {
    const byName = re.test(token) ? fit(sc) : [];
    if (byName.length) return byName;
  }
  return ['ALL_SCOPES'];
}

// ---- build rows -----------------------------------------------------------------------------------
const rows = [];
const byToken = new Map();
for (const t of tokens) {
  const decl = Object.fromEntries(Object.entries(css).map(([k, text]) => [k, declarations(text, t.token)]));
  const first = (k) => [...decl[k].keys()][0];
  const values = { default: classify(first('default')), compact: classify(first('compact')), dark: classify(first('dark')) };
  const flags = [];
  for (const k of ['default', 'compact', 'dark']) {
    if (decl[k].size > 1) flags.push(`multi-value:${k} (${[...decl[k].entries()].map(([v, s]) => `${v} @ ${s.join(' | ').slice(0, 60)}`).join(' || ')})`);
  }
  if (values.default.kind === 'missing') flags.push('missing-in-css: not in the built bundle - rebuild (pnpm run demos:prepare) or the token is dead');
  if (first('default') !== first('dark')) flags.push(`mode-dependent: light=${first('default')} dark=${first('dark')}`);
  if (unread.has(t.token)) flags.push('unread: the theme publishes it but no rule of the bundle reads it');
  for (const k of ['default', 'compact']) {
    const v = values[k];
    if (v.kind === 'literal') flags.push(`literal:${v.sub}:${k}=${v.raw}`);
    if (v.kind === 'ds' && NO_FIGMA_COUNTERPART.test(v.ds)) flags.push(`no-figma-counterpart:${v.ds}`);
    if (v.kind === 'ds' && /^box-shadow-(none|xs|sm|md|lg|xl|2xl)$/.test(v.ds)) flags.push(`composite:${v.ds} - an effect, not one variable`);
  }
  const file = t.scssVar ? definedIn(folder, t.scssVar) : t.rootFile ? (t.rootFile === '_colors.scss' ? 'colors' : 'sizes') : 'link';
  rows.push({ ...t, file, values, flags, usages: [...(usageIndex.get(t.token) || [])] });
  byToken.set(t.token, rows[rows.length - 1]);
}

function resolveType(row, seen = new Set()) {
  if (seen.has(row.token)) return undefined;
  seen.add(row.token);
  const v = row.values.default;
  if (v.kind === 'link') {
    const target = byToken.get(v.token) || (() => {
      const g = allTokens.get(v.token);
      if (!g) return undefined;
      const decl = declarations(css.default, v.token);
      return { token: v.token, values: { default: classify([...decl.keys()][0]) }, file: g.scssVar ? definedIn(g.folder, g.scssVar) : 'link' };
    })();
    return target ? resolveType(target, seen) : undefined;
  }
  return { type: figmaType(v), file: row.file };
}

const sizeModes = ['default', 'compact'];
for (const r of rows) {
  const resolved = resolveType(r) || {};
  r.type = resolved.type;
  const fileHint = r.file === 'link' ? resolved.file : r.file;
  const byValue = r.type === 'COLOR' ? 'theme' : r.type ? 'size' : undefined;
  const byFile = fileHint === 'colors' ? 'theme' : fileHint === 'sizes' ? 'size' : undefined;
  r.collection = byValue || byFile || 'size';
  if (byValue && byFile && byValue !== byFile) r.flags.push(`collection-mismatch: defined in _${fileHint}.scss but the value is ${r.type}`);
  if (r.collection === 'theme' && JSON.stringify(r.values.default) !== JSON.stringify(r.values.compact)) {
    r.flags.push('size-dependent-colour: theme has one mode, default and compact differ');
  }
  if (r.type === 'EFFECT') r.flags.push('effect: no variable - apply the Foundation effect style shadow/<size> to the node, see edge-cases.md');
  if (r.values.default.kind === 'link' && !byToken.has(r.values.default.token)) {
    const g = allTokens.get(r.values.default.token);
    r.flags.push(`link-cross-widget: ${r.values.default.token}${g ? ` (published by ${g.folder})` : ' (not published by any widget)'}`);
  }
  r.flags = [...new Set(r.flags)];
  r.figmaName = figmaName(r.token);
  r.scopes = scopesFor(r.token, r.usages, r.type);
  const modes = r.collection === 'theme' ? ['fluent-next'] : sizeModes;
  const src = { 'fluent-next': r.values.default, default: r.values.default, compact: r.values.compact };
  r.spec = {
    name: r.figmaName,
    css: `--dx-${r.token}`,
    collection: r.collection,
    type: r.type || 'UNKNOWN',
    scopes: r.scopes,
    values: Object.fromEntries(modes.map((m) => {
      const v = src[m];
      if (v.kind === 'ds') return [m, { ds: v.ds }];
      if (v.kind === 'link') return [m, { link: figmaName(v.token) }];
      return [m, { unresolved: v.raw ?? null }];
    })),
  };
  const blocking = r.flags.filter((f) => /^(literal|no-figma-counterpart|composite|effect|mode-dependent|size-dependent-colour|missing-in-css|multi-value)/.test(f));
  if (blocking.length || r.spec.type === 'UNKNOWN') r.spec.skip = true;
  if (r.flags.length) r.spec.flags = r.flags;
}

// ---- output ---------------------------------------------------------------------------------------
const spec = {
  widget: folder,
  generatedFrom: path.relative(repo, cssDir),
  builtAt: builtAt.toISOString(),
  collections: { theme: ['fluent-next'], size: sizeModes },
  tokens: rows.map((r) => r.spec),
};

if (opt('--spec')) {
  fs.writeFileSync(path.resolve(opt('--spec')), `${JSON.stringify(spec, null, 2)}\n`);
}

if (args.includes('--json')) {
  console.log(JSON.stringify({ ...spec, rows: rows.map(({ spec: _s, ...r }) => r) }, null, 2));
  process.exit(0);
}

const show = (v) => (v.kind === 'ds' ? `ds:${v.ds}${v.note ? ` (${v.note})` : ''}` : v.kind === 'link' ? `→ ${figmaName(v.token)}` : v.kind === 'missing' ? '—' : `\`${v.raw}\``);
const count = (c) => rows.filter((r) => r.collection === c).length;
console.log(`# ${folder} — ${rows.length} tokens (theme ${count('theme')}, size ${count('size')})`);
console.log(`built CSS: ${path.relative(repo, cssDir)} (built ${builtAt.toLocaleString('sv')})`);
const stale = fs.readdirSync(path.join(themeDir, folder === 'root' ? '' : folder)).some((f) => fs.statSync(path.join(themeDir, folder === 'root' ? '' : folder, f)).mtime > builtAt);
if (stale) console.log('**WARNING: the SCSS of this widget is newer than the built CSS — rebuild with `pnpm run demos:prepare`.**');
console.log('');
console.log('| Figma variable | coll | type | default / fluent-next | compact | read by (default bundle) | flags |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) {
  const compact = r.collection === 'size' ? show(r.values.compact) : '';
  const used = r.usages.slice(0, 2).join('<br>') + (r.usages.length > 2 ? `<br>+${r.usages.length - 2}` : '');
  console.log(`| ${r.figmaName} | ${r.collection} | ${r.type || '?'} | ${show(r.values.default)} | ${compact} | ${used || '—'} | ${r.flags.map((f) => f.split(':')[0]).join(', ')} |`);
}
const flagged = rows.filter((r) => r.flags.length);
if (flagged.length) {
  console.log('\n## Flags (each is an edge case to settle with the user before writing it to Figma)\n');
  for (const r of flagged) console.log(`- \`${r.figmaName}\`: ${r.flags.join('; ')}`);
}
const skipped = rows.filter((r) => r.spec.skip).length;
console.log(`\n${rows.length - skipped} tokens ready for upsert, ${skipped} marked "skip" until resolved.`);
