#!/usr/bin/env node
// The UI Kit checklist: the order the kit's components are worked on, and who is doing what.
// The file is CHECKLIST.md next to SKILL.md. Every change is committed straight on top of the remote
// branch and pushed, so designers working in parallel always see the current state.
//
//   node .claude/skills/fluent-next-ui-kit/scripts/checklist.mjs build --graph <graph.json> [--local]
//   node .claude/skills/fluent-next-ui-kit/scripts/checklist.mjs show [<component>] [--local]
//   node .claude/skills/fluent-next-ui-kit/scripts/checklist.mjs next [--local]
//   node .claude/skills/fluent-next-ui-kit/scripts/checklist.mjs set <component> <todo|in-progress|review|merged|blocked>
//        [--branch <figma branch url>] [--who <name>] [--note <text>] [--force] [--local]
//
// <graph.json> is the result of scripts/figma/component-graph.js. <component> is the name in the table
// (Button, .TextEditor, Tab Panel) - case-insensitive.
//
// Every change is pushed at once - see scripts/lib/publish.mjs for where and how. --local reads and
// writes the local file only, without git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { me as gitUser, publish as publishFile, readCurrent as readFile } from './lib/publish.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(here, '..', 'CHECKLIST.md');

const STATUS = {
  todo: '⬜ не начат',
  'in-progress': '🟦 в работе',
  review: '🟨 на ревью',
  merged: '✅ смёржен',
  blocked: '⛔ заблокирован',
};
const statusKey = (label) => Object.keys(STATUS).find((k) => STATUS[k] === label.trim()) || 'todo';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !['--graph', '--branch', '--who', '--note'].includes(args[i - 1]));
const [command, ...rest] = positional;

const readCurrent = () => readFile(FILE, { local: flag('--local') });
const publish = (mutate, message) => publishFile(FILE, mutate, message, { local: flag('--local') });

// ---- the table -------------------------------------------------------------------------------------
const COLUMNS = ['#', 'Компонент', 'Ур.', 'Состоит из', 'Используется в', 'Статус', 'Ветка', 'Кто', 'Обновлено', 'Заметки'];
const KEY = /<!--\s*key:(\S+)\s*-->/;
const clean = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

function parseRows(text) {
  const rows = [];
  for (const line of (text || '').split('\n')) {
    const m = line.match(KEY);
    if (!m || !line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.length < COLUMNS.length) continue;
    rows.push({
      key: m[1],
      name: cells[1].replace(KEY, '').trim(),
      status: statusKey(cells[5]),
      branch: (cells[6].match(/\((https?:[^)]+)\)/) || [])[1] || '',
      who: cells[7],
      updated: cells[8],
      note: cells[9],
      deps: cells[3] === '—' ? [] : cells[3].split(',').map((s) => s.trim()).filter(Boolean),
    });
  }
  return rows;
}

function rowLine(n, r) {
  return `| ${[
    n,
    `${r.name} <!-- key:${r.key} -->`,
    r.level,
    r.deps.length ? r.deps.join(', ') : '—',
    r.dependents.length ? r.dependents.join(', ') : '—',
    STATUS[r.status],
    r.branch ? `[ветка](${r.branch})` : '',
    clean(r.who),
    clean(r.updated),
    clean(r.note),
  ].join(' | ')} |`;
}

const HEADER = `# Чек-лист UI Kit · Fluent Next

Порядок работы над компонентами кита «DevExtreme UI Kit (AI Generated)» и кто что делает. Файл ведёт скилл
\`fluent-next-ui-kit\`: он меняет статус, когда берёт компонент в работу и когда заканчивает, и сразу пушит
изменение. Так все видят актуальное состояние, даже работая параллельно.

## Как читать

- **Порядок — снизу вверх по зависимостям.** \`Ур. 0\` — элементарные компоненты, внутри которых нет других
  компонентов кита. Компонент уровня N собран из компонентов уровней ниже N.
- **Компоненты одного уровня можно делать параллельно.** Внутри уровня выше стоят те, что чаще встречаются в
  других: они разблокируют больше.
- **Компонент можно брать в работу, когда все компоненты из колонки «Состоит из» смёржены.** Список доступных
  выдаёт \`node .claude/skills/fluent-next-ui-kit/scripts/checklist.mjs next\`.
- **Статусы:** ⬜ не начат → 🟦 в работе (ветка, кто) → 🟨 на ревью (агент закончил, ждёт дизайнера) →
  ✅ смёржен. ⛔ заблокирован — причина в заметке.
- **Ветки создают и мёржат дизайнеры.** Когда ветка смёржена, скажите агенту «<компонент> смёржен» или поправьте
  статус сами.
- **Ручные правки — только в колонках «Статус», «Ветка», «Кто», «Обновлено» и «Заметки».** Остальное
  перестраивается из графа компонентов (\`scripts/figma/component-graph.js\` → \`checklist.mjs build\`).
`;

function render(items, previous, meta) {
  const prev = new Map(parseRows(previous).map((r) => [r.key, r]));
  const kit = items.filter((i) => i.block === 'kit');
  const byKey = new Map(items.map((i) => [i.key, i]));
  const dependents = new Map(items.map((i) => [i.key, []]));
  for (const i of items) for (const d of i.dependsOn) if (dependents.has(d.key)) dependents.get(d.key).push(i);

  // levels: longest path down to an elementary component; a cycle is reported, not looped on
  const level = new Map();
  const visiting = new Set();
  const cycles = new Set();
  const levelOf = (key) => {
    if (level.has(key)) return level.get(key);
    if (visiting.has(key)) { cycles.add(key); return 0; }
    visiting.add(key);
    const deps = byKey.get(key).dependsOn.filter((d) => byKey.has(d.key) && byKey.get(d.key).block === 'kit');
    const l = deps.length ? 1 + Math.max(...deps.map((d) => levelOf(d.key))) : 0;
    visiting.delete(key);
    level.set(key, l);
    return l;
  };
  items.forEach((i) => levelOf(i.key));

  const usedBy = (i) => dependents.get(i.key).filter((d) => d.block !== 'assets');
  const weight = (i) => usedBy(i).reduce((sum, d) => sum + ((d.dependsOn.find((x) => x.key === i.key) || {}).instances || 0), 0);
  const order = (list) => [...list].sort((a, b) => level.get(a.key) - level.get(b.key)
    || usedBy(b).length - usedBy(a).length
    || weight(b) - weight(a)
    || a.name.localeCompare(b.name));
  const toRow = (i) => {
    const p = prev.get(i.key) || {};
    return {
      key: i.key,
      name: i.name,
      level: i.block === 'kit' ? level.get(i.key) : '—',
      deps: i.dependsOn.map((d) => d.name),
      dependents: usedBy(i).map((d) => d.name),
      status: p.status || 'todo',
      branch: p.branch || '',
      who: p.who || '',
      updated: p.updated || '',
      note: [cycles.has(i.key) ? 'цикл зависимостей' : '', p.note || ''].filter(Boolean).join('; '),
    };
  };
  const table = (rows) => [`| ${COLUMNS.join(' | ')} |`, `|${COLUMNS.map(() => '---').join('|')}|`, ...rows.map((r, n) => rowLine(n + 1, r))].join('\n');

  const parts = [HEADER];
  parts.push(`Граф собран из файла «${meta.file}» (\`${meta.fileKey}\`) ${String(meta.generatedAt).slice(0, 10)}.\n`);
  parts.push('## Компоненты кита\n');
  parts.push(table(order(kit).map(toRow)));
  const assets = items.filter((i) => i.block === 'assets');
  if (assets.length) {
    parts.push('\n## Ассеты\n');
    parts.push('Иконки — общие ассеты, а не тематические компоненты. Компоненты используют их через подмену инстанса.\n');
    parts.push(table(assets.map(toRow)));
  }
  const draft = items.filter((i) => i.block === 'in-progress');
  if (draft.length) {
    parts.push('\n## Черновые страницы\n');
    parts.push('Страницы после разделителя «IN PROGRESS». Берутся в работу, когда дизайнеры решат, что черновик готов.\n');
    parts.push(table(order(draft).map(toRow)));
  }
  const gone = [...prev.values()].filter((r) => !byKey.has(r.key));
  if (gone.length) {
    parts.push('\n## Больше нет в ките\n');
    parts.push('Строки, чьих компонентов не нашлось в последнем графе. Статусы сохранены, чтобы ничего не потерялось.\n');
    parts.push(table(gone.map((r) => ({ ...r, level: '—', dependents: [] }))));
  }
  return `${parts.join('\n')}\n`;
}

function findRow(rows, name) {
  const n = name.toLowerCase();
  return rows.find((r) => r.name.toLowerCase() === n) || rows.find((r) => r.key === name);
}

function updateRow(text, name, change) {
  const lines = text.split('\n');
  const rows = parseRows(text);
  const row = findRow(rows, name);
  if (!row) throw new Error(`no row "${name}" in the checklist`);
  const i = lines.findIndex((l) => l.includes(`<!-- key:${row.key} -->`));
  const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const next = change(row);
  cells[5] = STATUS[next.status];
  cells[6] = next.branch ? `[ветка](${next.branch})` : '';
  cells[7] = clean(next.who);
  cells[8] = clean(next.updated);
  cells[9] = clean(next.note);
  lines[i] = `| ${cells.join(' | ')} |`;
  return lines.join('\n');
}

const today = () => new Date().toLocaleDateString('sv');
const me = () => opt('--who') || gitUser();

// ---- commands ------------------------------------------------------------------------------------
try {
  if (command === 'build') {
    const graph = JSON.parse(fs.readFileSync(path.resolve(opt('--graph')), 'utf8'));
    publish((prev) => render(graph.items, prev, graph), `UI Kit checklist: rebuild from the component graph of ${graph.file}`);
  } else if (command === 'set') {
    const [name, status] = rest;
    if (!name || !STATUS[status]) throw new Error(`usage: set <component> <${Object.keys(STATUS).join('|')}> [--branch <url>] [--who <name>] [--note <text>]`);
    if (status === 'in-progress' && !opt('--branch')) throw new Error('in-progress needs --branch <figma branch url>');
    publish((text) => {
      if (text === null) throw new Error('there is no checklist yet: run build first');
      return updateRow(text, name, (row) => {
        if (status === 'in-progress' && row.status === 'in-progress' && row.branch && row.branch !== opt('--branch') && !flag('--force')) {
          throw new Error(`${row.name} is already in progress: ${row.who || 'someone'}, ${row.branch}. Ask the user; --force takes it over.`);
        }
        return {
          status,
          branch: opt('--branch') !== undefined ? opt('--branch') : row.branch,
          who: status === 'todo' ? '' : (opt('--who') || (status === 'in-progress' ? me() : row.who || me())),
          updated: today(),
          note: opt('--note') !== undefined ? opt('--note') : row.note,
        };
      });
    }, `UI Kit checklist: ${name} → ${STATUS[status]}`);
  } else if (command === 'show' || command === 'next') {
    const text = readCurrent();
    if (text === null) throw new Error('there is no checklist yet: run build first');
    const rows = parseRows(text);
    const byName = new Map(rows.map((r) => [r.name, r]));
    const ready = (r) => r.deps.every((d) => (byName.get(d) || {}).status === 'merged');
    if (command === 'show' && rest[0]) {
      const r = findRow(rows, rest[0]);
      if (!r) throw new Error(`no row "${rest[0]}" in the checklist`);
      console.log(`${r.name}: ${STATUS[r.status]}${r.who ? `, ${r.who}` : ''}${r.branch ? `, ${r.branch}` : ''}${r.updated ? `, ${r.updated}` : ''}${r.note ? ` — ${r.note}` : ''}`);
      for (const d of r.deps) console.log(`  состоит из ${d}: ${STATUS[(byName.get(d) || {}).status || 'todo']}`);
      console.log(ready(r) ? 'все зависимости смёржены' : 'НЕ все зависимости смёржены — это пограничный случай, обсуди с пользователем');
    } else if (command === 'show') {
      const count = (s) => rows.filter((r) => r.status === s).length;
      console.log(Object.keys(STATUS).map((s) => `${STATUS[s]}: ${count(s)}`).join(' · '));
      for (const r of rows.filter((x) => ['in-progress', 'review', 'blocked'].includes(x.status))) {
        console.log(`  ${STATUS[r.status]} ${r.name}${r.who ? ` — ${r.who}` : ''}${r.branch ? ` — ${r.branch}` : ''}${r.note ? ` — ${r.note}` : ''}`);
      }
    } else {
      const available = rows.filter((r) => r.status === 'todo' && ready(r));
      console.log(`Можно брать в работу (${available.length}), в порядке чек-листа:`);
      for (const r of available.slice(0, 15)) console.log(`  ${r.name}${r.deps.length ? ` (состоит из: ${r.deps.join(', ')})` : ''}`);
      if (available.length > 15) console.log(`  … ещё ${available.length - 15}`);
    }
  } else {
    console.error('usage: checklist.mjs <build|show|next|set> … (see the header of this file)');
    process.exit(2);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
