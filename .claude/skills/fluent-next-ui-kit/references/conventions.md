# Соглашения кита

Решения согласованы с командой 8 октября 2026. Здесь они расписаны подробно, с примерами. Применяй их и не
пересматривай. Новые договорённости по повторяющимся случаям записывай в журнал «Решено» в
[edge-cases.md](edge-cases.md).

## Имена токенов

Имя переменной в Figma = CSS-имя Fluent Next без `--dx-`. Префикс компонента вынесен в группу через `/`:

| CSS (Fluent Next) | Переменная в Figma |
|---|---|
| `--dx-button-default-contained-bg-hovered` | `button/default-contained-bg-hovered` |
| `--dx-button-height` | `button/height` |
| `--dx-check-box-checked-bg` | `check-box/checked-bg` |
| `--dx-button-group-separator` | `button-group/separator` (побеждает самый длинный префикс) |
| `--dx-grid-row-bg` | `grid/row-bg` (папка `gridBase`, префикс `grid`) |
| `--dx-focus-rect-outline-width` | `focus-rect/outline-width` (системный слой `common`) |
| `--dx-global-font-family` | `global/font-family` |
| `--dx-typography-heading-1-font-size` | `typography/heading-1-font-size` |
| `--dx-font-size` | `font-size` (токен `:root` без префикса, без группы) |

- **Обратимость.** Замени `/` на `-`, допиши `--dx-` — получишь CSS-имя. На этом держится связь кита с кодом,
  поэтому имена не сокращаются, не переставляются и не «улучшаются».
- **Префикс компонента** — kebab-имя папки виджета из `packages/devextreme-scss/tools/naming/registries.json`
  (поле `components`): `button`, `button-group`, `check-box`, `text-editor`, `drop-down-editor`, `grid`.
  Системный слой (`common`, `typography`, `viz`) группируется по «concern» из того же файла (`systemConcerns`):
  `focus-rect`, `global`, `invalid-badge`, `typography`, `viz`. Всё это скрипт `component-tokens.mjs` делает сам.
- **Code syntax.** У каждой переменной code syntax WEB = `var(--dx-…)`. В Dev Mode разработчик видит настоящую
  CSS-переменную. Скрипт upsert выставляет его сам.
- **Новых имён не придумывай.** Если Figma нужно значение, для которого во Fluent Next нет токена, это
  пограничный случай (см. [edge-cases.md](edge-cases.md#значение-без-токена)).

## Коллекции и режимы

| Коллекция | Режимы | Что в ней |
|---|---|---|
| `theme` | `fluent-next` | токены типа COLOR |
| `size` | `default`, `compact` | FLOAT и STRING: размеры, отступы, радиусы, толщины, типографика |

- **Светлой и тёмной темы среди режимов нет.** Цветовые токены компонентов Fluent Next ссылаются на семантические
  роли (`color/bg-*`, `color/content-*`, `color/border-*`), а роли переключаются коллекцией `Theme Switcher`
  в Foundation tokens (режимы Fluent Light / Fluent Dark). Скрипт `component-tokens.mjs` сверяет светлый и тёмный
  бандлы. Если значение отличается, получишь флаг `mode-dependent` — это пограничный случай.
- **`default` и `compact`** соответствуют двум бандлам: `dx.fluent-next.blue.light.css` и
  `dx.fluent-next.blue.light.compact.css`.
- **Коллекции живут в main.** Ветки только добавляют в них переменные (см.
  [figma.md](figma.md#ветки-и-коллекции)).
- **Тип определяется значением**, а не файлом SCSS. Цвет идёт в `theme`, остальное в `size`. Если тип и файл
  расходятся (например, `font-family` объявлен в `_colors.scss`), скрипт ставит флаг `collection-mismatch` и
  кладёт токен по значению.

## Значения

| Значение в собранном CSS | Значение переменной |
|---|---|
| `var(--dxds-color-bg-primary-hovered)` | алиас `Theme Switcher / color/bg-primary-hovered` |
| `var(--dxds-spacing-320)` | алиас `Core / spacing/320` |
| `var(--dxds-font-weight-base-strong)` | алиас `Theme Switcher / font-weight/base-strong` |
| `var(--dxds-primary-120)` | алиас `Fluent Palettes / primary/120` |
| `var(--dx-button-normal-contained-bg-active)` | алиас локальной `button/normal-contained-bg-active` |
| `transparent` | алиас `Theme Switcher / color/none` |
| `calc(…)`, `color-mix(…)`, `normal`, `none`, `0.75em`, `1.428571` | пограничный случай |

- **Правило `--dxds-a-b` ↔ переменная `a/b`** проверено на всех 947 токенах `--dxds-*`, 926 совпали 1:1.
  Пары нет у `font-family-system-*`, `font-family-segoe-ui|inter|roboto|serif`, `text-case-*`, `text-decoration-*`,
  `icon-color-*` (флаг `no-figma-counterpart`). Окончательно решает скрипт upsert: всё, что он не нашёл, он
  перечисляет в `unresolvedDs`.
- **Палитры.** Одни и те же палитры есть и во Fluent Palettes, и в Material Palettes. Для Fluent Next источник
  всегда Fluent Palettes. Material Palettes не используется никогда.
- **Где что лежит в Foundation tokens:**
  - `Core` — `spacing/*`, `border-radius/*`, `border-width/*`, `opacity/*`, шкалы `font-size/100…`,
    `line-height/100…`, `font-weight/100…`, `letter-spacing/*`;
  - `Theme Switcher` — `color/*`, `global/*`, семантическая типографика (`font-size/base-md`,
    `line-height/base-md`, `font-weight/base-strong`, `font-family/sans-serif`) и `box-shadow/layer-*`;
  - `Fluent Palettes` — `primary/*`, `neutral/*`, `gray/*` и т.д.;
  - `decorative-colors/*` — служебные цвета для рамок и аннотаций кита, в компонентах не используются.
- **Ссылки из `_public-links.scss`** сохраняются ссылками. Не сворачивай `button/normal-text-bg-hovered` до
  конечного значения: в коде это «то же, что `button/normal-contained-bg-hovered`», и в ките должно быть так же.

## Свойства компонента

Свойства повторяют API виджета дословно, в нижнем регистре. Источник — `packages/devextreme/js/ui/<widget>.d.ts`.

| Что | Как в Figma | Пример (Button) |
|---|---|---|
| Опция API с перечислимыми значениями | VARIANT, имя опции, значения API | `type=normal\|default\|success\|danger`, `stylingMode=contained\|outlined\|text` |
| Состояние во время работы | VARIANT `state` | `state=rest\|hovered\|focused\|active\|selected\|disabled` |
| Необязательная часть, которая только показывается | BOOLEAN по классу-модификатору DOM | `hasIcon` (`dx-button-has-icon`) |
| Необязательная часть, которая меняет раскладку | VARIANT `true\|false` с тем же именем | `hasText` (у кнопки только с иконкой другие отступы) |
| Текст | TEXT | `text` |
| Иконка | INSTANCE_SWAP | `icon` |

- **`state`** повторяет классы `dx-state-hover`, `dx-state-focused`, `dx-state-active`, `dx-state-disabled`,
  `dx-state-readonly` и выбор (`dx-item-selected` / `dx-state-selected`). Значения — из словаря состояний
  Fluent Next: `hovered`, `focused`, `active`, `selected`, `selected-hovered`, …, `disabled`, `read-only`; плюс
  `rest`. Берутся только состояния, которые тема стилизует, то есть для них есть токены или правила. Порядок:
  `rest`, `hovered`, `focused`, `active`, `selected…`, `read-only`, `disabled`.
- **Опции API, которые не ложатся на свойство однозначно**, например `value: boolean | null` у CheckBox, где
  `null` означает indeterminate, — пограничный случай. Решение по ним записывай в журнал.
- **Значения по умолчанию** — как в API (`type=normal`, `stylingMode=contained`, `state=rest`). Вариант с ними
  ставится левым верхним: в Figma вариант по умолчанию определяется положением на холсте.
- **Порядок свойств в панели:** сначала оси API в порядке важности (`type`, `stylingMode`, …), потом `state`,
  потом части (`hasText`, `hasIcon`), потом содержимое (`text`, `icon`).

## Слои

- **Один слой на элемент DOM**, у которого есть свои визуальные свойства или свойства раскладки. Обёртка,
  у которой их нет, складывается в родителя. Обёртка, чья единственная роль — отступы или раскладка, тоже
  складывается в родителя, если у родителя нет конфликтующей раскладки: «концептуально как в DOM, без лишних
  блоков».
- **Имя слоя** — класс элемента без `dx-`: `button-content`, `button-text`, `icon`. Корень — сам вариант.
- **Существующие слои переименовываются на месте.** Переопределения инстансов держатся за слой. Удалить и
  создать заново слой текста или иконки значит потерять подписи и иконки во всех инстансах кита.
- **CSS border** — это обводка `INSIDE` плюс `strokesIncludedInLayout = true` на рамке. Так рамка ведёт себя как
  `box-sizing: border-box`: обводка занимает место внутри размера, отступы считаются от неё. Так сделано и в
  vNext UI Kit.

## Привязки

| CSS-свойство | Поле Figma | Scope переменной |
|---|---|---|
| `background-color` | заливка (paint) | `FRAME_FILL`, `SHAPE_FILL` |
| `color` текста | заливка текстового слоя | `TEXT_FILL` |
| `color` иконки (глиф шрифта) | заливка вектора иконки (переопределение в инстансе) | `SHAPE_FILL` |
| `border-color`, `outline-color` | обводка (paint) | `STROKE_COLOR` |
| `border-width` | `strokeTopWeight`, `strokeRightWeight`, `strokeBottomWeight`, `strokeLeftWeight` | `STROKE_FLOAT` |
| `border-radius` | `topLeftRadius` … `bottomRightRadius` | `CORNER_RADIUS` |
| `padding-*` | `paddingTop/Right/Bottom/Left` | `GAP` |
| `gap`, `margin` между соседями | `itemSpacing` | `GAP` |
| `height`, `min-height`, `width`, `min-width` | `height`, `minHeight`, `width`, `minWidth` | `WIDTH_HEIGHT` |
| `font-size` | `fontSize` | `FONT_SIZE` |
| `font-weight` | `fontWeight` | `FONT_WEIGHT` |
| `font-family` | `fontFamily` | `FONT_FAMILY` |
| `line-height` | `lineHeight` | `LINE_HEIGHT` |
| `letter-spacing` | `letterSpacing` | `LETTER_SPACING` |
| `opacity` | `opacity` | `OPACITY` |
| `box-shadow` | эффекты, по полям | пограничный случай, см. [edge-cases.md](edge-cases.md#составные-значения-box-shadow) |

- **Стили текста не используются.** Поля текста привязываются по одному, как в vNext UI Kit.
- **Каждое поле — к токену компонента**, а не к переменной Foundation напрямую. Компонентный слой и есть смысл
  кита: поменял токен — поменялся компонент. Если у элемента своего токена нет, используется общий токен
  (`font-size`, `global/font-family`), см. [edge-cases.md](edge-cases.md#свойство-без-токена-компонента).
- **Scopes** скрипт выводит из того, какие CSS-свойства читают токен. Если токен никто не читает, scopes
  берутся по имени. Проверяй их в таблице скрипта: с неверным scope переменная не появится в нужном пикере
  Figma.

## Разобранный пример: Button

DOM в демке:

```
div.dx-button.dx-button-mode-contained.dx-button-normal.dx-button-has-icon.dx-button-has-text
└ div.dx-button-content
   ├ i.dx-icon.dx-icon-save
   └ span.dx-button-text
```

Figma: `.dx-button-content` несёт только отступы и раскладку, поэтому складывается в корень.

```
вариант (корень: .dx-button + .dx-button-content)
├ icon         инстанс иконки
└ button-text  текст
```

| Слой и поле | Токен |
|---|---|
| корень, заливка | `button/<type>-<stylingMode>-bg`, в состояниях `…-bg-hovered/-focused/-active/-selected`; у `disabled` для contained — `button/contained-bg-disabled` |
| корень, обводка (только outlined) | `button/<type>-outlined-border`; у `disabled` — `button/outlined-border-disabled`; толщина — `button/border-width` |
| корень, радиусы | `button/border-radius` |
| корень, высота | `button/height` (в CSS это `height` и `min-width`) |
| корень, отступы при `hasText=true` | `button/padding-block`, `button/padding-inline` |
| корень, отступы при `hasText=false` | `button/content-padding` (`calc`, в демке 5px — пограничный случай) |
| корень, промежуток | `button/icon-margin` (в демке `margin-inline-end` иконки 8px) |
| корень, тень (только normal contained) | `button/box-shadow` = `box-shadow-xs`, пограничный случай |
| icon, размер | `button/icon-size` |
| icon, цвет глифа | `button/<type>-contained-icon` у contained; у outlined и text — цвет содержимого (смотри колонку «read by») |
| button-text, заливка | `button/<type>-<stylingMode>-content[-state]`; у `disabled` — `button/content-disabled` |
| button-text, начертание | `button/text-font-weight` |
| button-text, размер и гарнитура | общие токены `font-size`, `global/font-family` |
| button-text, интерлиньяж | `button/text-line-height` = `normal` → Auto, не привязывается |
| button-text, межбуквенный интервал | `button/text-letter-spacing` = `normal` → 0, не привязывается |

Токены `button/padding-*`, `button/icon-size` и `button/icon-margin` тема публикует, но правила их не читают:
отступы в CSS заданы через `var(--dxds-spacing-*)` напрямую. Значения совпадают с тем, что видно в демке, поэтому
привязываем к ним — так кит документирует намерение. Почему так — см.
[edge-cases.md](edge-cases.md#непрочитанный-токен-unread).

Свойства: `type`, `stylingMode`, `state` (`rest|hovered|focused|active|selected|disabled`), `hasText` (вариант:
меняет отступы), `hasIcon` (boolean), `text`, `icon`. `selected` у самой кнопки появляется только внутри
ButtonGroup — включать ли его в Button, решается как пограничный случай.
