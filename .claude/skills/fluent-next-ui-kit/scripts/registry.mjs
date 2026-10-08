#!/usr/bin/env node
// The two registries the skill keeps for settled edge cases (next to SKILL.md, pushed at once like the
// checklist - see scripts/lib/publish.mjs):
//   foundation -> DEV-HANDOFF.md  the edge case was settled with a Foundation token; for the developers
//   hardcoded  -> HARDCODED.md    the edge case was settled with a hard-coded value
//
//   node .claude/skills/fluent-next-ui-kit/scripts/registry.mjs init [--local]          creates both files if missing
//   node .claude/skills/fluent-next-ui-kit/scripts/registry.mjs add foundation --component <name> --where <figma place>
//        --code <what the theme code has> --value <the Foundation token used> --why <proposal to developers>
//        [--branch <figma branch url>] [--who <name>] [--local]
//   node .claude/skills/fluent-next-ui-kit/scripts/registry.mjs add hardcoded --component <name> --where <figma place>
//        --value <the value, per mode> [--code <what the theme code has>] --why <why no token> --todo <what removes it>
//        [--branch <url>] [--who <name>] [--local]
//   node .claude/skills/fluent-next-ui-kit/scripts/registry.mjs list [foundation|hardcoded] [--component <name>] [--open] [--local]
//   node .claude/skills/fluent-next-ui-kit/scripts/registry.mjs resolve <foundation|hardcoded> <#> --note <outcome> [--local]
//
// A row is keyed by component + where: adding the same place again updates that row instead of adding one.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { me, publish, readCurrent } from './lib/publish.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OPEN = '🔸 открыто';
const DONE = '✅ сделано';

const KINDS = {
  foundation: {
    file: path.resolve(here, '..', 'DEV-HANDOFF.md'),
    columns: ['#', 'Компонент', 'Где в Figma', 'В коде темы', 'Взяли в Figma', 'Предложение разработчикам', 'Статус', 'Итог', 'Ветка', 'Кто', 'Дата'],
    fields: ['code', 'value', 'why'],
    required: ['component', 'where', 'code', 'value', 'why'],
    commit: 'UI Kit dev handoff',
    header: `# Для разработчиков: где кит взял значения из Foundation tokens

Сюда скилл \`fluent-next-ui-kit\` записывает пограничные случаи, которые решили через токены Foundation. Это
места, где в коде темы Fluent Next значение выражено не через дизайн-токен: \`calc()\`, \`em\`, литерал,
\`color-mix()\`, или у компонента нет своего токена. В Figma такое значение взяли из Foundation tokens: алиасом
компонентного токена, прямой привязкой поля или стилем эффекта.

Каждая запись — предложение разработчикам выразить то же значение через дизайн-токены. Тогда кит и код будут
совпадать по смыслу, а не только по пикселям.

- **Статусы:** 🔸 открыто — ждёт решения разработчиков; ✅ сделано — тема поправлена или решили оставить как есть
  (подробности в «Итог»).
- **Файл ведёт скилл.** Вручную правьте только «Статус» и «Итог», или попросите агента:
  \`registry.mjs resolve foundation <#> --note "…"\`.
`,
  },
  hardcoded: {
    file: path.resolve(here, '..', 'HARDCODED.md'),
    columns: ['#', 'Компонент', 'Где в Figma', 'Значение', 'В коде темы', 'Почему не токен', 'Что нужно, чтобы убрать', 'Статус', 'Итог', 'Ветка', 'Кто', 'Дата'],
    fields: ['value', 'code', 'why', 'todo'],
    required: ['component', 'where', 'value', 'why', 'todo'],
    commit: 'UI Kit hardcoded',
    header: `# Реестр захардкоженных значений кита

Пограничные случаи, где решили захардкодить значение: сырое значение переменной или поле без привязки к токену.
Такое место выпадает из системы токенов: оно не меняется вместе с темой, режимом \`size\` или Foundation tokens.
Реестр нужен, чтобы ни одно такое место не потерялось и со временем каждое заменили токеном.

- **Статусы:** 🔸 открыто; ✅ сделано — хардкод заменён токеном или решили, что он не мешает (подробности в «Итог»).
- **Файл ведёт скилл.** Вручную правьте только «Статус» и «Итог», или попросите агента:
  \`registry.mjs resolve hardcoded <#> --note "…"\`.
`,
  },
};

const args = process.argv.slice(2);
const VALUE_FLAGS = ['--component', '--where', '--code', '--value', '--why', '--todo', '--branch', '--who', '--note'];
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));
const [command, kindName, ref] = positional;
const local = flag('--local');

const clean = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const KEY = /<!--\s*key:([^>]*?)\s*-->/;
// the key sits in an HTML comment inside a table cell: no "|", no "--", plain characters only
const keyOf = (component, where) => `${clean(component)}~${clean(where)}`.toLowerCase()
  .replace(/[^a-z0-9а-яё./~_ -]/g, '').replace(/-{2,}/g, '-').replace(/\s+/g, '_');
const today = () => new Date().toLocaleDateString('sv');

function parse(text, kind) {
  const rows = [];
  for (const line of (text || '').split('\n')) {
    const m = line.match(KEY);
    if (!m || !line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.length < kind.columns.length) continue;
    const row = { key: m[1], line };
    kind.columns.forEach((c, i) => { row[c] = i === 1 ? cells[i].replace(KEY, '').trim() : cells[i]; });
    rows.push(row);
  }
  return rows;
}

function render(kind, rows) {
  const head = `| ${kind.columns.join(' | ')} |\n|${kind.columns.map(() => '---').join('|')}|`;
  const body = rows.map((r) => `| ${kind.columns.map((c, i) => (i === 1 ? `${r[c]} <!-- key:${r.key} -->` : r[c] ?? '')).join(' | ')} |`).join('\n');
  return `${kind.header}\n${head}${body ? `\n${body}` : ''}\n`;
}

try {
  const kind = KINDS[kindName];
  if (command === 'init') {
    for (const k of Object.values(KINDS)) {
      publish(k.file, (text) => (text === null ? render(k, []) : text), `${k.commit}: create the registry`, { local });
    }
  } else if (command === 'add') {
    if (!kind) throw new Error('usage: add <foundation|hardcoded> --component … --where … (see the header of this file)');
    const values = Object.fromEntries(['component', 'where', 'code', 'value', 'why', 'todo'].map((f) => [f, opt(`--${f}`)]));
    const missing = kind.required.filter((f) => !values[f]);
    if (missing.length) throw new Error(`missing ${missing.map((f) => `--${f}`).join(', ')}`);
    const key = keyOf(values.component, values.where);
    publish(kind.file, (text) => {
      const rows = parse(text, kind);
      let row = rows.find((r) => r.key === key);
      if (!row) {
        row = { key, '#': String(rows.reduce((n, r) => Math.max(n, Number(r['#']) || 0), 0) + 1), Статус: OPEN, Итог: '' };
        rows.push(row);
      }
      row['Компонент'] = clean(values.component);
      row['Где в Figma'] = clean(values.where);
      const map = { code: 'В коде темы', value: kindName === 'foundation' ? 'Взяли в Figma' : 'Значение', why: kindName === 'foundation' ? 'Предложение разработчикам' : 'Почему не токен', todo: 'Что нужно, чтобы убрать' };
      for (const f of kind.fields) if (values[f] !== undefined) row[map[f]] = clean(values[f]);
      if (opt('--branch') !== undefined) row['Ветка'] = opt('--branch') ? `[ветка](${opt('--branch')})` : '';
      row['Кто'] = clean(opt('--who') || me());
      row['Дата'] = today();
      return render(kind, rows);
    }, `${kind.commit}: ${clean(values.component)} › ${clean(values.where)}`, { local });
  } else if (command === 'resolve') {
    if (!kind || !ref || !opt('--note')) throw new Error('usage: resolve <foundation|hardcoded> <#> --note <outcome>');
    publish(kind.file, (text) => {
      const rows = parse(text, kind);
      const row = rows.find((r) => r['#'] === String(ref));
      if (!row) throw new Error(`no row #${ref} in ${path.basename(kind.file)}`);
      row['Статус'] = DONE;
      row['Итог'] = clean(opt('--note'));
      row['Дата'] = today();
      return render(kind, rows);
    }, `${kind.commit}: #${ref} → ${DONE}`, { local });
  } else if (command === 'list') {
    const kinds = kind ? [kindName] : Object.keys(KINDS);
    for (const k of kinds) {
      const text = readCurrent(KINDS[k].file, { local });
      let rows = parse(text, KINDS[k]);
      if (opt('--component')) rows = rows.filter((r) => r['Компонент'].toLowerCase() === opt('--component').toLowerCase());
      if (flag('--open')) rows = rows.filter((r) => r['Статус'] === OPEN);
      console.log(`${path.basename(KINDS[k].file)}: ${rows.length}`);
      for (const r of rows) {
        const what = k === 'foundation' ? `${r['В коде темы']} → ${r['Взяли в Figma']}` : `${r['Значение']} (${r['Почему не токен']})`;
        console.log(`  #${r['#']} ${r['Статус']} ${r['Компонент']} › ${r['Где в Figma']}: ${what}`);
      }
    }
  } else {
    console.error('usage: registry.mjs <init|add|list|resolve> … (see the header of this file)');
    process.exit(2);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
