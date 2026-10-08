# Где что искать в репозитории

Пути от корня репозитория. `<widget>` — папка виджета во Fluent Next в camelCase (`checkBox`), `<widget_file>` —
имя файла API в snake_case (`check_box`).

## Токены темы

| Что | Где |
|---|---|
| Опубликованные токены компонента (имена) | `packages/devextreme-scss/scss/widgets/fluent-next/<widget>/_public.scss` — сгенерирован `tools/naming/publish.mjs`, руками не правится |
| Ссылки между токенами | `…/fluent-next/<widget>/_public-links.scss` (`--dx-a: var(--dx-b)`) |
| Откуда значения | `…/fluent-next/<widget>/_colors.scss` и `_sizes.scss` — переменные `$<widget>-…` = `ds.$…` |
| `ds.$…` → `--dxds-*` | `packages/devextreme-scss/scss/_design-system/variables/_ds.scss` |
| Какие селекторы публикуют токены | `…/fluent-next/_public-tier.scss` (например, `.dx-button, .dx-dropdowneditor-button`) |
| Глобальный слой `:root` | `…/fluent-next/_sizes.scss` (`--dx-font-size`, `--dx-component-height`, …) и `_colors.scss` (`--dx-color-*`) |
| Системный слой | `…/fluent-next/common/_public.scss` (`focus-rect`, `global`, badges), `typography/_public.scss`, `viz/_public.scss` |
| Правила, которые используют токены | `…/fluent-next/<widget>/_index.scss`, общий базовый слой `packages/devextreme-scss/scss/widgets/base/<widget>/` |
| Опубликованные токены, которые никто не читает | `packages/devextreme-scss/tools/review/unread-tier.json` |
| Замороженные значения (иконки в data-uri и т.п.) | `…/fluent-next/DIVERGENCES.md` |
| Грамматика имён | `packages/devextreme-scss/tools/naming/registries.json`: `parseRule` `$<component>(-<sub-element>)*(-<modifier>)*-<slot>(-<state>)`, словари `states`, `parts`, `components`, `systemConcerns` |

**Собранный CSS — главный источник значений:** SCSS в нём уже раскрыт до `var(--dxds-*)`. Скрипт берёт его из
`apps/demos/node_modules/devextreme-dist/css/`, а если там нет — из `packages/devextreme/artifacts/css/`.
Нужны три файла: `dx.fluent-next.blue.light.css`, `.light.compact.css`, `.dark.css`. Если SCSS виджета новее
бандла, скрипт предупредит. Тогда пересобери: `pnpm run demos:prepare`.

## API и разметка

| Что | Где |
|---|---|
| Публичный API (опции, их значения и умолчания) | `packages/devextreme/js/ui/<widget_file>.d.ts`, например `button.d.ts` (`type`, `stylingMode`, `icon`, `text`) |
| Реализация и рендер (какие элементы и классы при каких опциях) | `packages/devextreme/js/__internal/ui/<widget_file>/` или `…/ui/<widget_file>.ts` (Button — `ui/button/button.tsx`) |
| Классы состояний | `packages/devextreme/js/__internal/core/widget/widget.ts`: `dx-state-hover`, `dx-state-active`, `dx-state-focused`, `dx-state-disabled` |
| Демки | `apps/demos/Demos/<Widget>/<Demo>/` (`jQuery/`, `React/`, `Angular/`, `Vue/`) |

Разметку надёжнее всего смотреть в живой демке ([demos.md](demos.md)): там она такая, какая есть при данных
опциях. Код рендера нужен, чтобы понять, при каких опциях появляются и пропадают элементы и классы-модификаторы
(`dx-button-has-icon`, `dx-checkbox-indeterminate`).

## Как читать вывод `component-tokens.mjs`

Колонки таблицы:

- **Figma variable** — имя переменной.
- **coll / type** — коллекция и тип переменной.
- **default / compact** — значения: `ds:<x>` — переменная Foundation, `→ <имя>` — ссылка на другой токен,
  `` `…` `` — литерал.
- **read by** — CSS-свойство и селектор, которые читают токен в светлом бандле. По ним видно, к какому слою и
  полю Figma привязывать.

Флаги — это пограничные случаи. Что делать с каждым, расписано в [edge-cases.md](edge-cases.md).

| Флаг | Значение |
|---|---|
| `literal:calc` / `color-mix` / `keyword` / `number` / `color` | значение не сводится к одной переменной Foundation |
| `no-figma-counterpart` | у `--dxds-*` нет переменной в Foundation tokens |
| `composite`, `effect` | `box-shadow`: это эффект из нескольких слоёв, а не одна переменная |
| `mode-dependent` | значение в светлом и тёмном бандле отличается |
| `size-dependent-colour` | у цветового токена default и compact отличаются, а у `theme` один режим |
| `multi-value` | токен переобъявлен под другим селектором с другим значением |
| `missing-in-css` | токена нет в собранном CSS: бандл устарел или токен мёртвый |
| `unread` | тема публикует токен, но ни одно правило бандла его не читает |
| `collection-mismatch` | файл SCSS и тип значения указывают на разные коллекции |
| `link-cross-widget` | ссылка на токен другого виджета: он должен уже быть в main |

Записи с блокирующими флагами помечаются в спецификации как `"skip": true`. Upsert их не пишет, пока ты не
заменишь `unresolved` на решение и не уберёшь `skip`. `unread`, `collection-mismatch` и `link-cross-widget`
запись не блокируют, но в плане их всё равно назови.
