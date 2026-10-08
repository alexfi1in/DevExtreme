# Работа в Figma

Общие правила Plugin API и обходы его ловушек — в скилле `figma-ai-cookbook`, загрузи его до первого
`figma_execute`. Здесь только то, что относится к киту.

## Ветки и коллекции

- **Один компонент — одна ветка.** Ветками распоряжаются дизайнеры: они создают ветку (File → Create branch),
  обновляют её из main и мёржат. Задачи по ветке они тоже запускают явно. Агент работает внутри выданной ветки
  и действий с ветками не делает. Через плагин их и не сделать. Ссылка на ветку выглядит так:
  `https://www.figma.com/design/<mainKey>/branch/<branchKey>/<имя>`.
- **Подключение.** Ветку открывают в Figma Desktop и запускают в ней плагин Desktop Bridge. После этого
  `figma_list_open_files` покажет её под именем ветки. Дальше `figma_navigate { url, lock: true }`, чтобы цель
  не уехала в другой открытый файл.
- **Проверка ключа.** В ветке `figma.fileKey` — это ключ ветки, а не основного файла. Все скрипты скилла
  начинаются с проверки этого ключа. Ответ `WRONG_FILE` значит, что ты не там: остановись.
- **Коллекции `theme` и `size` должны прийти из main.** Если создать их в двух ветках, получатся две разные
  коллекции с одинаковыми именами, и после мёржа в main будут дубли. По той же причине общие токены (`common`,
  `typography`, `root`) создаются один раз в main, а не в ветке, которой они понадобились первой.
- **Зависимость от другого компонента.** Если компоненту нужны токены другого, ещё не смёрженного компонента
  (кнопки DropDownButton на токенах `button`), — это пограничный случай. Обычный выход: дизайнеры мёржат ветку
  того компонента и обновляют твою ветку из main. Ты только объясняешь, что нужно, и ждёшь.

## Подготовка main (один раз)

Это отдельная задача: дизайнер запускает её явно («подготовь main для кита»), потому что она меняет основной
файл. Из работы над компонентом её не начинают — там достаточно сказать, что main не подготовлен. Порядок:

1. **Коллекции.** Сгенерируй код и выполни его в main:

   ```bash
   node .claude/skills/fluent-next-ui-kit/scripts/figma-code.mjs bootstrap --file-key DpK8J5xUCl7Gc70DKC4I1K
   ```

2. **Общие токены.** Сначала реши их пограничные случаи: `global/line-height` (1.428571), `focus-rect/outline-offset-inset`
   (calc), `global/dropdown-box-shadow` и другие. Потом сгенерируй спецификации и запиши их в main:

   ```bash
   node .claude/skills/fluent-next-ui-kit/scripts/component-tokens.mjs common --spec <scratchpad>/common.spec.json
   node .claude/skills/fluent-next-ui-kit/scripts/component-tokens.mjs typography --spec <scratchpad>/typography.spec.json
   node .claude/skills/fluent-next-ui-kit/scripts/component-tokens.mjs root --spec <scratchpad>/root.spec.json
   node .claude/skills/fluent-next-ui-kit/scripts/figma-code.mjs upsert --file-key DpK8J5xUCl7Gc70DKC4I1K --spec <scratchpad>/common.spec.json --main
   ```

   Флаг `--main` нужен, потому что без него генератор отказывается писать в основной файл.
3. **Ветки.** Только после этого дизайнеры создают ветки компонентов. Уже существующие ветки дизайнеры обновляют
   через «Update from main».

## Как запускать скрипты скилла

1. **Сгенерируй код в scratchpad:**

   ```bash
   node .claude/skills/fluent-next-ui-kit/scripts/figma-code.mjs <bootstrap|upsert|audit> --file-key <key> [...] > <scratchpad>/<имя>.js
   ```

2. **Выполни его.** Прочитай файл и передай содержимое в `figma_execute` как `code`, вместе с `fileKey: <key>` и
   `timeout: 30000`.
3. **Проверь ответ.** Если пришло `WRONG_FILE`, `ERROR` или `problems`, сначала разберись с ними, потом иди дальше.
4. **Ошибка соединения** вида «Unable to establish connection» бывает временной. Проверь `figma_get_status { probe: true }`
   и повтори вызов.

Что делает каждый скрипт:

- **`audit`** только читает и выводит:
  - свойства и недостающие комбинации вариантов;
  - дерево варианта по умолчанию с привязками;
  - непривязанные значения, сгруппированные по слоям, с числом вариантов и значениями;
  - привязки по видам: `tier` — к `theme`/`size`, это правильно; `library` — напрямую к Foundation;
    `other-local` — к другой локальной коллекции; `missing` — к удалённой переменной;
  - страницы с инстансами.
- **`upsert`** создаёт и обновляет переменные по спецификации, ставит алиасы, scopes и code syntax. Его можно
  безопасно перезапускать. Записи со `"skip": true` он не пишет. Большой виджет дели через `--only '<regex>'`.
- **`bootstrap`** создаёт коллекции, если их нет, и проверяет режимы, если они уже есть.

## Рецепты привязок

Переменные ищи по имени в локальных коллекциях:

```js
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const byName = new Map();
for (const c of cols.filter((c) => ['theme', 'size'].includes(c.name))) {
  for (const id of c.variableIds) { const v = await figma.variables.getVariableByIdAsync(id); byName.set(v.name, v); }
}
const tok = (name) => { const v = byName.get(name); if (!v) throw new Error(`no token ${name}`); return v; };
```

- **Заливка и обводка.** `setBoundVariableForPaint` возвращает новую заливку, её нужно присвоить. Прозрачность
  заливки сбрось в 1: альфа уже внутри цвета Foundation (`color/bg-alpha`).

  ```js
  const solid = (n, list) => (n[list].find((p) => p.type === 'SOLID') || { type: 'SOLID', color: { r: 0, g: 0, b: 0 } });
  node.fills = [figma.variables.setBoundVariableForPaint({ ...solid(node, 'fills'), opacity: 1 }, 'color', tok('button/normal-contained-bg'))];
  node.strokes = [figma.variables.setBoundVariableForPaint({ ...solid(node, 'strokes'), opacity: 1 }, 'color', tok('button/normal-outlined-border'))];
  ```

- **Толщина обводки как CSS border.** Обводка `INSIDE`, `strokesIncludedInLayout` включён, привязаны все четыре
  стороны:

  ```js
  node.strokeAlign = 'INSIDE';
  node.strokesIncludedInLayout = true;
  for (const f of ['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight']) node.setBoundVariable(f, tok('button/border-width'));
  ```

  Где обводки в CSS нет, а заливка есть (contained), обводку убирай совсем: `node.strokes = []`. Не оставляй
  прозрачную.

- **Радиусы, отступы, промежуток, размеры:**

  ```js
  for (const f of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) node.setBoundVariable(f, tok('button/border-radius'));
  node.setBoundVariable('paddingTop', tok('button/padding-block')); node.setBoundVariable('paddingBottom', tok('button/padding-block'));
  node.setBoundVariable('paddingLeft', tok('button/padding-inline')); node.setBoundVariable('paddingRight', tok('button/padding-inline'));
  node.setBoundVariable('itemSpacing', tok('button/icon-margin'));
  node.setBoundVariable('height', tok('button/height')); // CSS min-width → 'minWidth'
  ```

- **Текст.** Сначала загрузи шрифт. После привязки гарнитуры и начертания Figma выберет стиль, например
  `Segoe UI Semibold`, и он тоже должен быть загружен. Если пришла ошибка «unloaded font», загрузи названный в ней
  шрифт и повтори.

  ```js
  await figma.loadFontAsync(t.fontName);
  t.setBoundVariable('fontFamily', tok('global/font-family'));
  t.setBoundVariable('fontWeight', tok('button/text-font-weight'));
  t.setBoundVariable('fontSize', tok('font-size'));
  t.fills = [figma.variables.setBoundVariableForPaint({ ...solid(t, 'fills'), opacity: 1 }, 'color', tok('button/normal-contained-content'))];
  ```

- **Цвет иконки.** Глиф — это вектор внутри инстанса иконки. Привязка его заливки внутри варианта становится
  переопределением, поэтому сама иконка остаётся общей:

  ```js
  const glyph = iconInstance.findOne((n) => ['VECTOR', 'BOOLEAN_OPERATION'].includes(n.type));
  glyph.fills = [figma.variables.setBoundVariableForPaint({ ...solid(glyph, 'fills'), opacity: 1 }, 'color', tok('button/normal-contained-icon'))];
  ```

- **Тень** — только после того, как решён пограничный случай про box-shadow. Поля эффекта привязываются по одному:

  ```js
  let e = { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.14 }, offset: { x: 0, y: 1 }, radius: 2, spread: 0, visible: true, blendMode: 'NORMAL' };
  for (const [field, part] of [['offsetX', 'x'], ['offsetY', 'y'], ['radius', 'blur'], ['spread', 'spread'], ['color', 'color']]) {
    e = figma.variables.setBoundVariableForEffect(e, field, foundation(`box-shadow/layer-1-${part}-xs`));
  }
  ```

  Здесь `foundation(name)` — переменная, импортированная из библиотеки:
  `figma.variables.importVariableByKeyAsync(key)`, ключ берётся из
  `figma.teamLibrary.getVariablesInLibraryCollectionAsync`.

## Как править набор компонентов, не ломая инстансы

Инстансы набора живут по всему киту (у Button — сотни, на страницах HtmlEditor, Chat, Scheduler и других).
Аудит показывает, где именно. Правила:

- **Переименование свойств и значений.** Перепиши имя каждого варианта. Main-компонент остаётся тем же узлом,
  поэтому инстансы сохраняют выбор:

  ```js
  const MAP = {
    Type: ['type', { Normal: 'normal', Default: 'default', Success: 'success', Danger: 'danger' }],
    'Styling Mode': ['stylingMode', { Contained: 'contained', Outlined: 'outlined', Text: 'text' }],
    State: ['state', { Rest: 'rest', Hover: 'hovered', Active: 'active', Disabled: 'disabled' }],
  };
  for (const v of set.children) {
    v.name = Object.entries(v.variantProperties).map(([k, val]) => `${MAP[k][0]}=${MAP[k][1][val]}`).join(', ');
  }
  ```

  Новые имена должны остаться уникальными. Если две старые комбинации сливаются в одну, набор уходит в ошибку
  `"Component set has existing errors"`.
- **Ось сливается или делится** (например, `Content=Icon + Text|Text Only|Icon Only` → `hasText` + `hasIcon`) —
  это миграция, и её план нужно согласовать. Порядок:
  1. Составь соответствие старых значений новым.
  2. Переведи инстансы лишних вариантов на остающиеся: `inst.setProperties({...})` для варианта и boolean.
  3. Удали лишние варианты.
  4. Переименуй оставшиеся.
- **Переименование TEXT, BOOLEAN и INSTANCE_SWAP:** `set.editComponentProperty('Label#67:194', { name: 'text' })`.
  Метод возвращает новый ключ. Новый boolean добавляется так:
  `set.addComponentProperty('hasIcon', 'BOOLEAN', true)`, а видимость слоя связывается с ним через
  `layer.componentPropertyReferences = { visible: key }`.
- **Слои.** Меняй имя, раскладку и привязки существующего узла. Не удаляй и не создавай заново слой, который
  инстансы переопределяют (текст, иконка): переопределения держатся за узел.
- **Новый вариант** делается клоном соседнего. `clone()` кладёт копию на текущую страницу, поэтому сразу перенеси
  её в набор:

  ```js
  const c = src.clone(); set.appendChild(c);
  c.name = 'type=normal, stylingMode=contained, state=focused, hasText=true';
  c.x = …; c.y = …; // в сетку набора
  // затем перепривяжи то, что отличается в этом состоянии
  ```

- **Удаление варианта** — только после переноса его инстансов:

  ```js
  for (const i of await v.getInstancesAsync()) i.setProperties({ state: 'hovered' });
  v.remove();
  ```

- **Сетка набора.** Варианты разложены вручную, без auto layout: поля 80px, ряды и колонки идут по значениям
  свойств, фон набора — подложка с радиусом 32. Новый вариант ставь в ряд и колонку, соответствующие его
  свойствам. Потом расширь набор через `set.resizeWithoutConstraints(w, h)`, чтобы поля остались по 80px.
  Вариант по умолчанию — левый верхний.
- **Аннотации `<Set> - Utils` не трогай.** Их перегенерируют плагином. В отчёте скажи, что сетка изменилась.

Что выяснилось на живых прогонах (CheckBox, 2026-10-08):

- **`clone()` варианта теряет связи слоёв со свойствами.** Пропадают `componentPropertyReferences`
  (видимость ↔ boolean, текст ↔ TEXT). После клонирования назначь их заново.
- **Порядок значений варианта хранится явно.** Переименованное значение остаётся на своём месте, новое
  добавляется в конец. Переставить можно «переносом в конец»: переименовывай варианты по одному во временное
  значение и обратно, перечитывая `componentPropertyDefinitions` между шагами. Порядок самих свойств в панели
  через API не меняется — попроси дизайнера перетащить их вручную и напиши об этом в отчёте.
- **У иконок кита включён замок пропорций.** Привязка высоты вытесняет привязку ширины. Перед привязкой обоих
  размеров вызови `unlockAspectRatio()`.
- **Выноси `await` из циклов.** Переменные (`getVariableByIdAsync`) и шрифты (`loadFontAsync`) загрузи до цикла
  правок. С `await` на каждой итерации 36 вариантов упираются в таймаут 30 с, без них привязываются за 0,7 с.
- **Старое переопределение у вложенного инстанса блокирует привязку из мастера.** Помогает `resetOverrides()` на
  этом инстансе, после чего верни ему имя слоя. Но это сбрасывает все его переопределения, включая текст:
  сначала запиши, что нужно восстановить.
- **Новое TEXT-свойство на слое с ручными переопределениями** переносит их в значения свойства у инстансов.
  Подписи вроде «Select All» сохраняются.

## Превью для сверки с демкой

Собери временную секцию на странице компонента. Вне набора, сбоку или ниже, не перекрывая существующее:

```js
const section = figma.createSection(); page.appendChild(section); section.name = 'Preview (agent) — удалить';
const frame = figma.createFrame(); section.appendChild(frame);
frame.layoutMode = 'HORIZONTAL'; frame.itemSpacing = 16; frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 24;
frame.layoutSizingHorizontal = 'HUG'; frame.layoutSizingVertical = 'HUG';
// фон превью можно привязать к Foundation напрямую, это не компонент
// инстансы нужных вариантов: set.defaultVariant.createInstance(); frame.appendChild(i); i.setProperties({...})
const themeSwitcher = await figma.variables.getVariableCollectionByIdAsync(someImportedColorVar.variableCollectionId);
frame.setExplicitVariableModeForCollection(themeSwitcher, themeSwitcher.modes.find((m) => m.name === 'Fluent Dark').modeId);
const size = (await figma.variables.getLocalVariableCollectionsAsync()).find((c) => c.name === 'size');
frame.setExplicitVariableModeForCollection(size, size.modes.find((m) => m.name === 'compact').modeId);
```

Сделай четыре рамки: light/default, light/compact, dark/default, dark/compact. Сними их через
`figma_capture_screenshot`, сравни со скриншотами демки и удали секцию: `section.remove()`.
