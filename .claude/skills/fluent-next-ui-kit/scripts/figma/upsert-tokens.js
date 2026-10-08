// figma_execute body. Creates or updates component-token variables from a spec written by
// scripts/component-tokens.mjs --spec. Idempotent: re-running it changes nothing that is already right.
//
// Value kinds in the spec, per mode:
//   { ds: "color-bg-primary" }        alias to the Foundation tokens variable whose name with "/"
//                                     replaced by "-" equals it (color/bg-primary)
//   { link: "button/normal-contained-bg-hovered" }   alias to another local component token
//   { value: 5 } / { value: "#ffffff" } / { value: "Segoe UI" }   raw value, only after the user approved it
// A token may carry "description" (e.g. the calc() formula it stands for); it is written to the variable.
// Tokens with "skip": true are reported, never written.
const EXPECTED_FILE_KEY = '/*@FILE_KEY@*/';
const SPEC = /*@SPEC@*/;
const LIBRARY = 'Foundation tokens';
const LIB_COLLECTIONS = ['Core', 'Theme Switcher', 'Fluent Palettes']; // Material Palettes is never a Fluent Next source
const WANT_MODES = { theme: ['fluent-next'], size: ['default', 'compact'] };

if (figma.fileKey !== EXPECTED_FILE_KEY) return { WRONG_FILE: figma.root.name, fileKey: figma.fileKey };

// ---- collections -------------------------------------------------------------------------------
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const coll = {};
for (const [name, modes] of Object.entries(WANT_MODES)) {
  coll[name] = cols.find((c) => c.name === name);
  if (!coll[name]) return { ERROR: `collection "${name}" is missing - it must come from main (bootstrap-collections.js), not be created in a branch` };
  const have = coll[name].modes.map((m) => m.name);
  if (JSON.stringify(have) !== JSON.stringify(modes)) return { ERROR: `collection "${name}" has modes ${have.join(', ')}, expected ${modes.join(', ')}` };
}
const modeId = (c, name) => coll[c].modes.find((m) => m.name === name).modeId;

const local = new Map(); // name -> Variable, both collections (links may cross them)
for (const c of Object.values(coll)) {
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v) local.set(v.name, v);
  }
}

// ---- Foundation tokens -------------------------------------------------------------------------
const tokens = SPEC.tokens.filter((t) => !t.skip);
const needDs = new Set();
for (const t of tokens) for (const v of Object.values(t.values)) if (v.ds) needDs.add(v.ds);

const libCols = (await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync())
  .filter((c) => c.libraryName === LIBRARY && LIB_COLLECTIONS.includes(c.name));
if (needDs.size && libCols.length < LIB_COLLECTIONS.length) {
  return { ERROR: `library "${LIBRARY}" is not enabled in this file, or lacks a collection`, found: libCols.map((c) => c.name) };
}
const index = new Map();
const lists = await Promise.all(libCols.map((c) => figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key)));
lists.forEach((list) => list.forEach((lv) => {
  const dash = lv.name.replace(/\//g, '-');
  if (!index.has(dash)) index.set(dash, lv);
}));
const unresolvedDs = [...needDs].filter((d) => !index.has(d));
const toImport = [...needDs].filter((d) => index.has(d));
const imported = await Promise.all(toImport.map((d) => figma.variables.importVariableByKeyAsync(index.get(d).key)));
const ds = new Map(toImport.map((d, i) => [d, imported[i]]));

// ---- pass 1: make sure every variable exists with the right type ---------------------------------
const report = { created: [], updated: [], unchanged: 0, skipped: [...(SPEC.skipped || [])], problems: [], unresolvedDs };
for (const t of SPEC.tokens) if (t.skip) report.skipped.push(t.name);

for (const t of tokens) {
  if (!['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(t.type)) { report.problems.push(`${t.name}: type ${t.type} cannot be a variable`); t.bad = true; continue; }
  const existing = local.get(t.name);
  if (existing) {
    if (existing.variableCollectionId !== coll[t.collection].id) { report.problems.push(`${t.name}: exists in another collection`); t.bad = true; }
    else if (existing.resolvedType !== t.type) { report.problems.push(`${t.name}: exists as ${existing.resolvedType}, spec says ${t.type}`); t.bad = true; }
    continue;
  }
  const v = figma.variables.createVariable(t.name, coll[t.collection], t.type);
  local.set(t.name, v);
  report.created.push(t.name);
}

// ---- pass 2: values, scopes, code syntax -----------------------------------------------------
function hexToRgba(hex) {
  const h = hex.replace('#', '');
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
}
function target(t, spec) {
  if (spec.ds) {
    const v = ds.get(spec.ds);
    if (!v) return { error: `ds ${spec.ds} not in ${LIBRARY}` };
    if (v.resolvedType !== t.type) return { error: `ds ${spec.ds} is ${v.resolvedType}, token is ${t.type}` };
    return { value: { type: 'VARIABLE_ALIAS', id: v.id } };
  }
  if (spec.link) {
    const v = local.get(spec.link);
    if (!v) return { error: `link target ${spec.link} does not exist (another component's branch not merged yet?)` };
    if (v.resolvedType !== t.type) return { error: `link target ${spec.link} is ${v.resolvedType}` };
    return { value: { type: 'VARIABLE_ALIAS', id: v.id } };
  }
  if ('value' in spec) {
    if (t.type === 'COLOR') return { value: typeof spec.value === 'string' ? hexToRgba(spec.value) : spec.value };
    return { value: spec.value };
  }
  return { error: 'no value' };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const t of tokens) {
  if (t.bad) continue;
  const v = local.get(t.name);
  let changed = false;
  for (const [mode, spec] of Object.entries(t.values)) {
    const tg = target(t, spec);
    if (tg.error) { report.problems.push(`${t.name} [${mode}]: ${tg.error}`); continue; }
    const id = modeId(t.collection, mode);
    if (!same(v.valuesByMode[id], tg.value)) { v.setValueForMode(id, tg.value); changed = true; }
  }
  if (t.scopes && !same([...v.scopes].sort(), [...t.scopes].sort())) { v.scopes = t.scopes; changed = true; }
  const web = `var(${t.css || `--dx-${t.name.replace(/\//g, '-')}`})`;
  if (v.codeSyntax.WEB !== web) { v.setVariableCodeSyntax('WEB', web); changed = true; }
  if (typeof t.description === 'string' && v.description !== t.description) { v.description = t.description; changed = true; }
  if (changed && !report.created.includes(t.name)) report.updated.push(t.name);
  if (!changed) report.unchanged += 1;
}

report.summary = `${SPEC.widget}: ${report.created.length} created, ${report.updated.length} updated, ${report.unchanged} unchanged, ${report.skipped.length} skipped, ${report.problems.length + unresolvedDs.length} problems`;
const cap = (a) => (a.length > 20 ? [...a.slice(0, 20), `… +${a.length - 20}`] : a);
report.created = cap(report.created);
report.updated = cap(report.updated);
return report;
