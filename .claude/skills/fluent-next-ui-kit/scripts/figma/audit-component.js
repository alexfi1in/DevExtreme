// figma_execute body. Read-only inventory and audit of one component set (or standalone component).
// Reports: properties, variant grid (and missing combinations), the layer tree of the default variant
// with its bindings, every visual value not bound to a variable, every binding that skips the
// component tier (bound straight to a library variable, or to a local variable outside theme/size),
// and every instance of the component in the file: pages, the other components whose main holds it
// (editing those edits that component), the variants in use and what instances override - raw paints,
// fixed sizes and fonts keep instances from following the tokens.
const EXPECTED_FILE_KEY = '/*@FILE_KEY@*/';
const TARGET_ID = '/*@NODE_ID@*/';
const INSTANCE_SCAN_BUDGET_MS = 15000;

if (figma.fileKey !== EXPECTED_FILE_KEY) return { WRONG_FILE: figma.root.name, fileKey: figma.fileKey };
const root = await figma.getNodeByIdAsync(TARGET_ID);
if (!root || !['COMPONENT_SET', 'COMPONENT'].includes(root.type)) return { ERROR: `${TARGET_ID} is ${root ? root.type : 'missing'}, expected a component set or component` };

const variants = root.type === 'COMPONENT_SET' ? root.children.filter((c) => c.type === 'COMPONENT') : [root];
const defs = root.type === 'COMPONENT_SET' || root.parent.type !== 'COMPONENT_SET' ? root.componentPropertyDefinitions : root.parent.componentPropertyDefinitions;
const props = {};
for (const [k, d] of Object.entries(defs)) props[k] = d.type === 'VARIANT' ? d.variantOptions : `${d.type}${d.defaultValue !== undefined ? ` = ${JSON.stringify(d.defaultValue)}` : ''}`;

// missing combinations of the variant grid
const axes = Object.entries(defs).filter(([, d]) => d.type === 'VARIANT').map(([k, d]) => [k, d.variantOptions]);
const have = new Set(variants.map((v) => axes.map(([k]) => `${k}=${v.variantProperties ? v.variantProperties[k] : ''}`).join(', ')));
let combos = [[]];
for (const [k, opts] of axes) combos = combos.flatMap((c) => opts.map((o) => [...c, `${k}=${o}`]));
const missing = combos.map((c) => c.join(', ')).filter((c) => !have.has(c));

// ---- variables ---------------------------------------------------------------------------------
const tierCollections = new Map();
for (const c of await figma.variables.getLocalVariableCollectionsAsync()) if (['theme', 'size'].includes(c.name)) tierCollections.set(c.id, c.name);
const varCache = new Map();
async function describe(id) {
  if (varCache.has(id)) return varCache.get(id);
  const v = await figma.variables.getVariableByIdAsync(id);
  let d;
  if (!v) d = { label: `MISSING(${id})`, kind: 'missing' };
  else if (v.remote) d = { label: `lib:${v.name}`, kind: 'library' };
  else if (tierCollections.has(v.variableCollectionId)) d = { label: `${tierCollections.get(v.variableCollectionId)}:${v.name}`, kind: 'tier' };
  else d = { label: `local:${v.name}`, kind: 'other-local' };
  varCache.set(id, d);
  return d;
}
function aliasIds(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.flatMap(aliasIds);
  if (val.type === 'VARIABLE_ALIAS') return [val.id];
  if (typeof val === 'object') return Object.values(val).flatMap(aliasIds);
  return [];
}

// ---- per-node checks -----------------------------------------------------------------------------
const hex = (c) => `#${[c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}${c.a !== undefined && c.a < 1 ? Math.round(c.a * 255).toString(16).padStart(2, '0') : ''}`;
const isBound = (n, field) => {
  const b = n.boundVariables || {};
  return aliasIds(b[field]).length > 0;
};
function unboundOf(n) {
  const out = [];
  const visiblePaints = (paints) => (Array.isArray(paints) ? paints.filter((p) => p.visible !== false) : []);
  for (const p of visiblePaints(n.fills)) if (p.type === 'SOLID' && !(p.boundVariables && p.boundVariables.color)) out.push(`fill ${hex({ ...p.color, a: p.opacity })}`);
  const strokes = visiblePaints(n.strokes);
  for (const p of strokes) if (p.type === 'SOLID' && !(p.boundVariables && p.boundVariables.color)) out.push(`stroke ${hex({ ...p.color, a: p.opacity })}`);
  if (strokes.length && typeof n.strokeWeight === 'number' && n.strokeWeight > 0
      && !['strokeWeight', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'].some((f) => isBound(n, f))) out.push(`strokeWeight ${n.strokeWeight}`);
  if ('topLeftRadius' in n) {
    for (const f of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) if (n[f] > 0 && !isBound(n, f)) { out.push(`radius ${n[f]}`); break; }
  }
  if ('layoutMode' in n && n.layoutMode !== 'NONE') {
    for (const f of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) if (n[f] > 0 && !isBound(n, f)) out.push(`${f} ${n[f]}`);
    const shown = n.children.filter((c) => c.visible).length;
    if (shown > 1 && n.itemSpacing > 0 && n.primaryAxisAlignItems !== 'SPACE_BETWEEN' && !isBound(n, 'itemSpacing')) out.push(`itemSpacing ${n.itemSpacing}`);
  }
  if ('layoutSizingVertical' in n && n.type !== 'TEXT') {
    if (n.layoutSizingVertical === 'FIXED' && !isBound(n, 'height') && !isBound(n, 'minHeight')) out.push(`fixedHeight ${Math.round(n.height)}`);
    if (n.layoutSizingHorizontal === 'FIXED' && n.type !== 'COMPONENT' && !isBound(n, 'width') && !isBound(n, 'minWidth')) out.push(`fixedWidth ${Math.round(n.width)}`);
  }
  if (n.type === 'TEXT') {
    const fs = n.fontSize;
    if (!isBound(n, 'fontSize')) out.push(`fontSize ${String(fs)}`);
    if (!isBound(n, 'fontWeight')) out.push(`fontWeight ${String(n.fontWeight)}`);
    if (!isBound(n, 'fontFamily')) out.push(`fontFamily ${n.fontName && n.fontName.family}`);
    if (n.lineHeight && n.lineHeight.unit && n.lineHeight.unit !== 'AUTO' && !isBound(n, 'lineHeight')) out.push(`lineHeight ${n.lineHeight.value}${n.lineHeight.unit === 'PERCENT' ? '%' : ''}`);
    if (n.letterSpacing && n.letterSpacing.value && !isBound(n, 'letterSpacing')) out.push(`letterSpacing ${n.letterSpacing.value}`);
  }
  if (Array.isArray(n.effects)) {
    for (const e of n.effects) if (e.visible !== false && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') && !(e.boundVariables && Object.keys(e.boundVariables).length)) out.push(`${e.type.toLowerCase()} unbound`);
  }
  return out;
}

// issues are grouped by layer path (relative to the variant root) and kind, so 144 variants with the
// same hardcoded padding read as one line with a count, not 144 lines
const issues = new Map(); // "path: kind" -> { variants: Set, values: Set }
let issueCount = 0;
function addIssue(where, u, variantName) {
  const [kind, ...val] = u.split(' ');
  const key = `${where}: ${kind}`;
  if (!issues.has(key)) issues.set(key, { variants: new Set(), values: new Set() });
  issues.get(key).variants.add(variantName);
  if (val.length) issues.get(key).values.add(val.join(' '));
  issueCount += 1;
}
const bindingKinds = { tier: new Set(), library: new Set(), 'other-local': new Set(), missing: new Set() };
async function noteBindings(n) {
  for (const id of aliasIds(n.boundVariables || {})) { const d = await describe(id); bindingKinds[d.kind].add(d.label); }
  for (const p of [...(Array.isArray(n.fills) ? n.fills : []), ...(Array.isArray(n.strokes) ? n.strokes : [])]) {
    for (const id of aliasIds(p.boundVariables || {})) { const d = await describe(id); bindingKinds[d.kind].add(d.label); }
  }
}
async function walk(n, rel, variantName) {
  const where = rel || '(root)';
  for (const u of unboundOf(n)) addIssue(where, u, variantName);
  await noteBindings(n);
  if (n.type === 'INSTANCE') {
    // the nested component is audited on its own page; here only what this component overrides on it
    for (const o of n.overrides || []) {
      if (!o.overriddenFields.some((f) => ['fills', 'strokes'].includes(f))) continue;
      const sub = await figma.getNodeByIdAsync(o.id);
      if (!sub) continue;
      for (const u of unboundOf({ fills: sub.fills, strokes: sub.strokes, boundVariables: sub.boundVariables })) addIssue(`${where} ◇ ${sub.name}`, `override-${u}`, variantName);
      await noteBindings(sub);
    }
    return;
  }
  if ('children' in n) for (const c of n.children) await walk(c, rel ? `${rel} > ${c.name}` : c.name, variantName);
}
for (const v of variants) await walk(v, '', v.name);

// ---- layer tree of the default variant -------------------------------------------------------------
const defaultVariant = root.type === 'COMPONENT_SET' ? root.defaultVariant : root;
async function tree(n, depth) {
  const o = { n: `${n.type === 'INSTANCE' ? '◇ ' : ''}${n.name}`, t: n.type };
  if ('layoutMode' in n && n.layoutMode !== 'NONE') o.layout = `${n.layoutMode} ${n.layoutSizingHorizontal}/${n.layoutSizingVertical} pad ${n.paddingTop},${n.paddingRight},${n.paddingBottom},${n.paddingLeft} gap ${n.itemSpacing}`;
  o.size = `${Math.round(n.width)}x${Math.round(n.height)}`;
  const refs = n.componentPropertyReferences;
  if (refs && Object.keys(refs).length) o.props = refs;
  const b = {};
  for (const [k, val] of Object.entries(n.boundVariables || {})) { const ids = aliasIds(val); if (ids.length) b[k] = (await Promise.all(ids.map(describe))).map((d) => d.label).join(' | '); }
  if (Object.keys(b).length) o.bound = b;
  if (n.type === 'TEXT') o.text = `${JSON.stringify(n.characters.slice(0, 24))} ${n.fontName && n.fontName.family} ${n.fontName && n.fontName.style} ${String(n.fontSize)}`;
  if (n.type === 'INSTANCE') { const mc = await n.getMainComponentAsync(); o.of = mc ? (mc.parent && mc.parent.type === 'COMPONENT_SET' ? `${mc.parent.name} / ${mc.name}` : mc.name) : '?'; }
  if (depth > 0 && 'children' in n && n.type !== 'INSTANCE') o.children = await Promise.all(n.children.map((c) => tree(c, depth - 1)));
  return o;
}

// ---- where the component is used, and what its instances override -------------------------------
// Every instance in the file, nested ones included (an instance inside an instance of another component
// still renders this one). getInstancesAsync misses nested ones, so pages are scanned instead.
await figma.loadAllPagesAsync();
const variantIds = new Set(variants.map((v) => v.id));
const usedOn = {}; // page -> instances
const inOwners = {}; // main component that contains the instance -> instances: editing them edits that component
const usedVariants = {}; // variant -> instances
const overrideKinds = {}; // kind -> instances overriding it
const overrideKind = (f) => {
  if (['fills', 'strokes'].includes(f)) return 'paint (raw colours win over the tokens of the main)';
  if (['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'layoutSizingHorizontal', 'layoutSizingVertical'].includes(f)) return 'size (a fixed size ignores the size modes)';
  if (['fontName', 'fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 'lineHeight', 'letterSpacing', 'textStyleId'].includes(f)) return 'font';
  if (['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'itemSpacing'].includes(f)) return 'spacing';
  return null; // text, visibility, swaps and property values are what instances are for
};
let total = 0;
let nested = 0;
let budgetHit = false;
const started = Date.now();
for (const page of figma.root.children) {
  if (Date.now() - started > INSTANCE_SCAN_BUDGET_MS) { budgetHit = true; break; }
  for (const inst of page.findAllWithCriteria({ types: ['INSTANCE'] })) {
    const main = await inst.getMainComponentAsync();
    if (!main || !variantIds.has(main.id)) continue;
    total += 1;
    usedOn[page.name] = (usedOn[page.name] || 0) + 1;
    usedVariants[main.name] = (usedVariants[main.name] || 0) + 1;
    let owner = null;
    let insideInstance = false;
    for (let p = inst.parent; p && p.type !== 'PAGE'; p = p.parent) {
      if (p.type === 'INSTANCE') insideInstance = true;
      if (!owner && p.type === 'COMPONENT') owner = p.parent && p.parent.type === 'COMPONENT_SET' ? p.parent.name : p.name;
    }
    if (insideInstance) nested += 1;
    if (owner) inOwners[owner] = (inOwners[owner] || 0) + 1;
    const kinds = new Set();
    for (const o of inst.overrides || []) for (const f of o.overriddenFields) { const k = overrideKind(f); if (k) kinds.add(k); }
    for (const k of kinds) overrideKinds[k] = (overrideKinds[k] || 0) + 1;
  }
}

const unbound = [...issues.entries()]
  .sort((a, b) => b[1].variants.size - a[1].variants.size)
  .map(([k, v]) => `${k} — ${v.variants.size}/${variants.length} variants${v.values.size ? `; values ${[...v.values].slice(0, 6).join(', ')}${v.values.size > 6 ? ', …' : ''}` : ''}`);
return {
  target: `${root.type} "${root.name}" (${root.id}) on page "${(() => { let p = root.parent; while (p && p.type !== 'PAGE') p = p.parent; return p && p.name; })()}"`,
  properties: props,
  variants: variants.length,
  missingCombinations: missing.length > 20 ? [...missing.slice(0, 20), `… +${missing.length - 20}`] : missing,
  defaultVariantTree: await tree(defaultVariant, 4),
  unbound: { total: issueCount, groups: unbound.length > 60 ? [...unbound.slice(0, 60), `… +${unbound.length - 60} groups`] : unbound },
  bindings: Object.fromEntries(Object.entries(bindingKinds).map(([k, s]) => [k, s.size > 30 ? [...[...s].slice(0, 30), `… +${s.size - 30}`] : [...s]])),
  instances: {
    total,
    nested,
    byPage: usedOn,
    insideOtherComponents: inOwners,
    variantsInUse: `${Object.keys(usedVariants).length}/${variants.length}`,
    overrides: overrideKinds,
    scan: budgetHit ? 'partial: the time budget ran out before every page was scanned' : 'all pages scanned',
  },
};
