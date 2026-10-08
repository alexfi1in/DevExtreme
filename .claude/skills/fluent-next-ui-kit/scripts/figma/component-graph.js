// figma_execute body. Read-only. Builds the component graph of the kit for the checklist
// (scripts/checklist.mjs build). One item per kit page; every top-level set or component on the
// "Sub-components" page is an item of its own, because many widgets share them. The Icons page and the
// pages after the "IN PROGRESS" header go to a separate block.
//
// An item depends on another when one of its main components holds an instance of the other's main
// component directly (not inside a third component's instance). Instances on the page canvas outside the
// main components (demo frames) are usage examples, not dependencies.
const EXPECTED_FILE_KEY = '/*@FILE_KEY@*/';
const SPLIT_PAGES = ['Sub-components'];
const ASSET_PAGES = ['Icons'];
const IN_PROGRESS_HEADER = /^\W*IN PROGRESS/; // the "🔨 IN PROGRESS..." header page, not "Scheduler (in progress)"
const SKIP_PAGE = /^(-+|↪︎.*|Thumbnail)$/;

if (figma.fileKey !== EXPECTED_FILE_KEY) return { WRONG_FILE: figma.root.name, fileKey: figma.fileKey };
await figma.loadAllPagesAsync();

const items = []; // { key, name, page, group, block, mains: [ids] }
const ownerOfMain = new Map(); // set id / standalone component id -> item key
let group = '';
let inProgress = false;
for (const page of figma.root.children) {
  const header = page.name.match(/^↪︎\s*(.+)$/);
  if (header) { group = header[1].trim(); continue; }
  if (IN_PROGRESS_HEADER.test(page.name)) { inProgress = true; continue; }
  if (SKIP_PAGE.test(page.name)) continue;
  const mains = page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })
    .filter((n) => n.type === 'COMPONENT_SET' || n.parent.type !== 'COMPONENT_SET');
  if (!mains.length) continue;
  const block = ASSET_PAGES.includes(page.name) ? 'assets' : inProgress ? 'in-progress' : 'kit';
  if (SPLIT_PAGES.includes(page.name)) {
    for (const m of mains.filter((n) => n.parent === page)) {
      const key = `set:${m.id}`;
      items.push({ key, name: m.name, page: page.name, group: 'Sub-components', block, mains: [m.id] });
      ownerOfMain.set(m.id, key);
    }
    // anything nested deeper on that page belongs to the top-level node that holds it
    for (const m of mains.filter((n) => n.parent !== page)) {
      let top = m;
      while (top.parent && top.parent !== page) top = top.parent;
      ownerOfMain.set(m.id, ownerOfMain.get(top.id) || `set:${top.id}`);
    }
    continue;
  }
  const key = `page:${page.id}`;
  items.push({ key, name: page.name, page: page.name, group, block, mains: mains.map((m) => m.id) });
  for (const m of mains) ownerOfMain.set(m.id, key);
}

// ---- dependencies ------------------------------------------------------------------------------
const deps = new Map(items.map((i) => [i.key, new Map()])); // item -> (dep item -> instance count)
const mainCache = new Map();
async function ownerOfInstance(inst) {
  const main = await inst.getMainComponentAsync();
  if (!main) return null;
  const top = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : main;
  if (mainCache.has(top.id)) return mainCache.get(top.id);
  const owner = ownerOfMain.get(top.id) || null;
  mainCache.set(top.id, owner);
  return owner;
}
async function collect(node, itemKey) {
  for (const child of node.children || []) {
    if (child.type === 'INSTANCE') {
      const owner = await ownerOfInstance(child);
      if (owner && owner !== itemKey) {
        const m = deps.get(itemKey);
        m.set(owner, (m.get(owner) || 0) + 1);
      }
      continue; // what is inside belongs to that component
    }
    if ('children' in child) await collect(child, itemKey);
  }
}
for (const item of items) {
  for (const id of item.mains) {
    const main = await figma.getNodeByIdAsync(id);
    const roots = main.type === 'COMPONENT_SET' ? main.children : [main];
    for (const r of roots) await collect(r, item.key);
  }
}

const byKey = new Map(items.map((i) => [i.key, i]));
return {
  file: figma.root.name,
  fileKey: figma.fileKey,
  generatedAt: new Date().toISOString(),
  items: items.map((i) => ({
    key: i.key,
    name: i.name,
    group: i.group,
    block: i.block,
    sets: i.mains.length,
    dependsOn: [...deps.get(i.key).entries()]
      .filter(([k]) => byKey.get(k) && byKey.get(k).block !== 'assets')
      .map(([k, n]) => ({ key: k, name: byKey.get(k).name, instances: n })),
    usesAssets: [...deps.get(i.key).entries()].filter(([k]) => byKey.get(k) && byKey.get(k).block === 'assets').reduce((s, [, n]) => s + n, 0),
  })),
};
