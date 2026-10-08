// figma_execute body. Creates the two component-token collections if they are missing:
//   theme  - one mode  "fluent-next"
//   size   - two modes "default", "compact"
// Idempotent: an existing collection is checked, never recreated. Run it in the MAIN file once,
// before any component branch exists (a collection created in a branch merges back as a duplicate).
const EXPECTED_FILE_KEY = '/*@FILE_KEY@*/';
const WANT = { theme: ['fluent-next'], size: ['default', 'compact'] };

if (figma.fileKey !== EXPECTED_FILE_KEY) return { WRONG_FILE: figma.root.name, fileKey: figma.fileKey };

const report = {};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
for (const [name, modes] of Object.entries(WANT)) {
  let c = cols.find((x) => x.name === name);
  if (!c) {
    c = figma.variables.createVariableCollection(name);
    c.renameMode(c.modes[0].modeId, modes[0]);
    for (const m of modes.slice(1)) c.addMode(m);
    report[name] = `created with modes ${modes.join(', ')}`;
    continue;
  }
  const have = c.modes.map((m) => m.name);
  report[name] = JSON.stringify(have) === JSON.stringify(modes)
    ? `exists, modes OK (${c.variableIds.length} variables)`
    : `EXISTS WITH DIFFERENT MODES ${have.join(', ')} - expected ${modes.join(', ')}; not touched, settle it with the user`;
}
return report;
