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

  **Обязательно верни клону связи со свойствами** (`componentPropertyReferences`, см. ниже) и в конце сверь все
  варианты с образцом по путям слоёв:

  ```js
  const path = (n, root) => { const p = []; for (let q = n; q && q !== root; q = q.parent) p.unshift(q.name); return p.join('/'); };
  const refsOf = (v) => new Map(v.findAll((x) => x.componentPropertyReferences && Object.keys(x.componentPropertyReferences).length)
    .map((x) => [path(x, v), x.componentPropertyReferences]));
  const ref = refsOf(template); // собранный вариант с той же структурой
  for (const v of set.children) for (const [p, r] of ref) {
    const n = v.findOne((x) => path(x, v) === p);
    if (n && JSON.stringify(n.componentPropertyReferences || {}) !== JSON.stringify(r)) n.componentPropertyReferences = r;
  }
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
  (видимость ↔ boolean, текст ↔ TEXT). После клонирования назначь их заново. **2026-10-15:** это пропустили на
  DropDownButton (216 клонов из 240 без `icon`/`hasIcon`/`text`/`showArrowIcon`), Accordion (2 варианта focused) и
  `.TextEditor` (12 вариантов invalid без clear, стрелки, спин-кнопок, placeholder и значения). Ошибку не видно
  на скриншоте набора, потому что у мастера скрытые слои и так скрыты. Нашла её дизайнер, включив свойства на
  инстансе. Исправлено сверкой по образцу (рецепт выше) в ветке `.TextEditor`. Сверка привязок — обязательный
  шаг проверки любого набора, где были клоны.
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

Что выяснилось на Button (2026-10-08):

- **Пока варианты переименованы не все, `variantProperties` бросает** `Component set for node has existing
  errors`: у вариантов разные имена свойств. Переименовывая оси, разбирай строку `v.name`, а не
  `variantProperties`.
- **Перенос значения в конец работает только по одному варианту.** Переименование всех вариантов значения разом
  — это переименование значения на месте. Сначала один вариант во временное значение (оно встаёт в конец),
  потом остальные, потом все обратно.
- **Смена `defaultValue` у boolean меняет все инстансы без своего значения**, вложенные тоже. Перед сменой
  поставь текущее значение явно инстансам верхнего уровня, затем найди вложенные, которые всё равно
  переключились (их источник сам вложен), и поставь им тоже.
- **Старый сырой `minHeight`** у вариантов не даёт высоте следовать за режимом `compact`. Убирай
  `minHeight`/`maxHeight`/`maxWidth`, которых нет в CSS.
- **Стиль тени Foundation не рисуется под прозрачной заливкой** (`showShadowBehindNode = false`). У кнопки с
  фоном `color/bg-alpha` (прозрачный в rest) тень в Figma не видна, хотя в CSS видна. С ButtonGroup contained
  (2026-10-15) то же самое: Figma строит тень по непрозрачным пикселям, а не по форме блока. Включённый
  `showShadowBehindNode` отбрасывает тень от текста и иконок, а это ещё хуже. Тень видна только с непрозрачной
  заливкой корня, но в коде её нет. Решено оставить как в коде и пометить в чек-листе как открытый вопрос.
  У групп (DropDownButton split, ButtonGroup) в hovered, focused и active тень обводит только кнопку с фоном, а
  не всю группу, как в браузере. Это то же ограничение, и тоже записывается в чек-лист как открытый вопрос.
  Так же у FloatingActionButton: у кнопки действия и её подписи фон в rest прозрачный (`speed-dial-action/bg` →
  `color/bg-alpha`), поэтому тени нет.

Что выяснилось на `.Label` (2026-10-14):

- **`importVariableByKeyAsync` может висеть минутами в свежей ветке**, а `figma_execute` падает по таймауту.
  Скрипт при этом продолжает работать в фоне и дописывает переменные. Прежде чем повторять upsert, перечитай
  локальные переменные: они могли уже появиться. Чтение списков библиотеки (`getVariablesInLibraryCollectionAsync`)
  при этом быстрое — зависает именно импорт.
- **Ось из `stylingMode` редактора проставляется по контексту**: имя ближайшего мастера или инстанса-родителя
  (`Styling Mode=Filled`) — надёжный признак.

Что выяснилось на `.DropDownButton` (2026-10-14):

- **Набор может уже быть в ошибке** (`Component set has existing errors`): вариант без имени свойства (`Rest`
  вместо `State=Rest`). `componentPropertyDefinitions` и `variantProperties` тогда бросают — читай имена
  вариантов и чини их строками.
- **`layoutSizingVertical = 'FILL'` у инстанса внутри мастера `.TextEditor` не сохранился**: запись без ошибки,
  `layoutAlign = STRETCH`, но высота осталась FIXED 20. Вложенные копии наследуют это. Если родитель выравнивает
  по центру, визуально разницы нет — оставь и запиши в заметку компонента-владельца.

Что выяснилось на CheckBox (2026-10-14):

- **Зависший импорт библиотеки оживает после `figma_reload_plugin`.** Если `importVariableByKeyAsync` не отвечает
  20+ с даже для одной переменной, перезапусти UI плагина и повтори — дальше импорт идёт за доли секунды.
  Если и это не помогло (RadioGroup, 2026-10-14), `figma_reload_plugin` обновляет только окно, а код плагина
  продолжает висеть: попроси дизайнера закрыть Desktop Bridge и запустить заново — после этого импорт прошёл
  за 0,6 с. Пока ждёшь, бери переменные Foundation из алиасов существующих токенов и делай структуру.
- **Базовый цвет привязанной заливки — это запасной цвет, и Figma иногда рисует именно его.** Заливка,
  собранная от `{ r: 0, g: 0, b: 0 }` и привязанная к переменной, хранит чёрный как raw-значение. Обычно Figma
  его обновляет, но не всегда: у одного варианта CheckBox фон и галочка остались чёрными на холсте. Всегда
  передавай в `setBoundVariableForPaint` paint с уже разрешённым цветом: `color` из
  `variable.resolveForConsumer(node).value`. Проверка после правок: у каждой привязанной заливки `hex(p.color)`
  должен совпадать с `resolveForConsumer`. **Альфу тоже переноси:** `opacity: r.a`. У прозрачных токенов
  (`button/normal-contained-bg`, `button/normal-text-bg` в rest, альфа 0) paint с `opacity: 1` у части клонов
  нарисовался сплошным чёрным или белым (DropDownButton, 2026-10-15). Сверяй и `p.opacity` с `r.a`.
- **Переопределение в копии инстанса чинится в первоисточнике.** Сырой цвет глифа нашёлся у 4 инстансов, но
  первоисточник был один (DataGrid); после его правки копии в TreeList подтянулись сами. Обходи инстансы от
  менее вложенных к более вложенным и перепроверяй после правки.

Что выяснилось на `.Tag` (2026-10-14):

- **Абсолютное позиционирование не переживает смену режима `size`.** Слой с `layoutPositioning = 'ABSOLUTE'` и
  constraint `MAX` остаётся на прежнем x, когда родитель-HUG сужается в compact: кнопка удаления тега вылезала за
  край на 6–9px. Элементы, которые в CSS `position: absolute` поверх `padding` (кнопка удаления тега), рисуй в
  потоке: рамка-резерв шириной по токену отступа (`tag-content-padding-inline-end`), внутри элемент по своему
  токену размера, прижатый к нужному краю. Видимость (`has…`) вешай на элемент, а не на резерв — тогда отступ
  остаётся и без элемента, как в теме. Проверяй такие места превью в compact на настоящем инстансе-владельце.
- **Переменная Foundation не переключается по режиму `size`.** Если значения в default и compact разные, а
  компонентного токена нет, прямая привязка к Foundation не подходит — нужен токен кита в коллекции `size`
  (`tag-box/tag-remove-button-icon-size`, с предложением в DEV-HANDOFF).

Что выяснилось на Bullet (2026-10-15):

- **Набор из вариантов «показать/скрыть» превращается в компонент с boolean без потери инстансов.** Перенеси
  используемый вариант из набора на страницу (`page.insertChild(i, variant)`). Он становится обычным
  `COMPONENT` с тем же id, и инстансы остаются связаны. Потом удали набор с остальными вариантами, если у них
  нет инстансов. Проверь это заранее через `getInstancesAsync()`. После этого добавь boolean-свойства и привяжи
  их к `visible` слоёв.
- **Constraint `SCALE` растягивает и ширину.** Метке фиксированной толщины (цель Bullet, `targetWidth: 4`) ставь
  `CENTER` по горизонтали. Тогда толщина держится, а положение сдвигается почти пропорционально. Полосе,
  которая зависит от значения, ставь `SCALE`.

Что выяснилось на ButtonGroup (2026-10-15):

- **Группа из инстансов другого компонента.** Если в DOM элементы группы — обычные виджеты (`dx-button`),
  оставляй их инстансами. Сначала `resetOverrides()`, чтобы ушли старые фиксированные размеры. Потом задай
  только то, что меняет CSS группы по позиции: внутренние радиусы 0, левую рамку 0. Разделитель, который в CSS
  является рамкой элемента (`border-inline-end`), делай переопределением stroke на инстансе с привязкой к токенам
  и `strokesIncludedInLayout = true`, а не отдельным фреймом. Ширина тогда совпадает с демкой (+1). Вложенные
  инстансы делай `isExposedInstance = true`, чтобы у каждого элемента менялись текст и состояние.

Что выяснилось на DropDownButton (2026-10-15):

- **Компонент, нарисованный кнопками, но не из инстансов Button** (у `action` есть иконка справа, которой нет
  у Button). Собирай свои слои, а привязки копируй с подходящего варианта Button: для каждого варианта найди
  вариант Button с теми же `type`, `stylingMode`, `state` и `hasText` и перенеси fills, strokes, толщины рамки,
  радиусы, высоту, отступы, шрифт, цвет текста и глифов. Так совпадение с Button гарантировано. Поверх
  накладывай свои токены и правила ButtonGroup по позиции.
- **Сотни вариантов.** Полностью собери по одному варианту на каждую комбинацию осей, которые меняют структуру
  (`splitButton × stylingMode × hasText`). Остальные клонируй и меняй только цветовые привязки и тень. 216
  клонов уложились в один вызов, 15 с.
- **Пересборка на месте.** Если старый слой уже назывался так же (`action`, `toggle`), проверка «вариант
  собран» по имени слоя врёт. Проверяй по привязке: например, у `action` есть `boundVariables.height`. Текстовый
  слой, на котором висят переопределения инстансов, перед очисткой вынеси в корень варианта, иначе он удалится
  вместе со старой обёрткой. Его id сохраняется, и подписи в инстансах переживают перенос в новый фрейм.

Что выяснилось на FloatingActionButton (2026-10-15):

- **Пустой набор удаляется сам.** Если удалить все варианты `COMPONENT_SET`, Figma удаляет и набор вместе с его
  id и связями инстансов. При полной пересборке сначала добавь новые варианты, потом удаляй старые. Если
  инстансов нет, можно собрать компоненты на странице и объединить их через `figma.combineAsVariants(nodes,
  page)`.
- **Стиль тени Foundation недоступен по ключу.** В файле есть только стили, которые уже кто-то применил
  (`shadow/xs` у Button). Для других размеров собери `DROP_SHADOW` из двух слоёв и привяжи поля к переменным
  `box-shadow/layer-{1,2}-{color,x,y,blur,spread}-<size>` из Theme Switcher:
  `figma.variables.setBoundVariableForEffect(effect, 'color'|'offsetX'|'offsetY'|'radius'|'spread', variable)`.
  Результат тот же, тёмная тема переключается.

Что выяснилось на `.TextEditor` (2026-10-15):

- **Фрейм «по содержимому» со всеми скрытыми детьми держит старую ширину.** Контейнер кнопок поля, где все
  кнопки скрыты, остался 44px и сдвинул значок ошибки. Ручное сжатие (`FIXED` → `resize(0.01, h)` → `HUG`)
  держится только до первого переключения: дизайнер включила и выключила кнопки на инстансе, и ширина снова
  застряла. **Решение — «якорь»:** положи в такой контейнер всегда видимый пустой фрейм `hug-anchor` 0.01×0.01
  (без заливки, `locked`). Тогда у контейнера всегда есть видимый ребёнок, и при скрытых кнопках он сжимается до
  нуля. Проверка на инстансе: включить все кнопки, выключить, сравнить позицию соседнего элемента.
- **Высоту поля задавай токеном, а не «по содержимому».** Корень «по содержимому» и дети «заполнить»
  (`.DropDownButton`, `.SpinButtons`, контейнеры кнопок) образуют круговую зависимость, и корень раздулся до 102.
  `height` = `text-editor/input-min-height`, `counterAxisSizingMode = FIXED`, а дети — `FILL`.
- **`setBoundVariable(f, null)` снимает привязку, но значение остаётся.** Сырая `minHeight 32` после снятия
  привязки не давала полю сжаться в compact. После отвязки обнуляй: `node.minHeight = null`.
- **Долгие сборки.** Помести сборщик в `globalThis.__fn` одним вызовом, потом вызывай `await
  globalThis.__fn(budgetMs)` короткими вызовами. Отмечай собранные варианты `setSharedPluginData`, чтобы прерванный
  по таймауту прогон продолжался с места. Первый вызов медленный (загрузка переменных), дальше вариант
  собирается меньше чем за секунду, даже когда у мастера 180 инстансов. **Прерванный по таймауту вызов может
  доработать в фоне** и пересобрать вариант уже после твоих следующих правок, затерев их: так у `.TextEditor`
  один вариант остался со старым отступом и сдвинутым значком. После любых таймаутов и правок поверх сборки
  проверь все варианты одной сверкой (порядок детей, привязки, ширины), а не по одному.
- **Перед `resetOverrides` у сотни инстансов-первоисточников** сохрани значения свойств и размеры в
  `figma.root.setSharedPluginData`, а после сброса верни их под новыми именами свойств. Высоту не возвращай, если
  её теперь задаёт токен. У вложенных копий старые переопределения шрифта и цвета лежат на уровне
  промежуточного инстанса (тулбар HtmlEditor); их тоже сбрасывай, начиная с менее вложенных. Записи на удалённые
  слои (`null` в `getNodeByIdAsync`) безвредны.
- **Абсолютные линии внизу с constraint `vertical: MAX` следуют за высотой корня при смене режима `size`**, если
  высота корня привязана к токену. В случае с `.Tag` было иначе: там абсолютный слой с `horizontal: MAX` стоял в
  родителе «по содержимому». Нижнюю линию у underlined проще рисовать нижней рамкой корня
  (`strokeBottomWeight`, `strokesIncludedInLayout = false`).

Что выяснилось на `labelMode` в `.TextEditor` (2026-10-15):

- **Обернуть содержимое варианта во внутренний фрейм без потери инстансов.** Создай фрейм, скопируй в него
  раскладку, заливки, рамки, радиусы, эффекты и привязки корня (`setBoundVariable` по списку
  `boundVariables`), перенеси детей `appendChild`, а корень сделай прозрачной обёрткой. Id перенесённых слоёв не
  меняются, переопределения в 180 инстансах уцелели.
- **Абсолютный слой, который должен следовать за режимом `size` по горизонтали:** положи его в абсолютный
  контейнер с фиксированным x, а нужный сдвиг задай `paddingLeft` контейнера, привязанным к токену. Так подпись
  `.TextEditor` стоит над текстом поля и в default (12), и в compact (8).
- **Перестановка значений после раскладки.** `insertChild` при раскладке сетки меняет порядок значений осей.
  Раскладывай, потом возвращай порядок переносом в конец по одному значению, по одному шагу на вызов.
- **Сверку по 120 вариантам делай частями** (`globalThis` + срезы по 30): один вызов на всё упёрся в таймаут,
  пока плагин доделывал прерванный прогон.

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
