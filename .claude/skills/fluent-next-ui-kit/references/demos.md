# Демки: запуск и осмотр живого компонента

## Запуск

Сначала проверь, не запущен ли сервер: `lsof -iTCP:8080 -sTCP:LISTEN`. Второй экземпляр не запускай.

1. **Node.** Нужна 24.16+: `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"` (системная 24.3 не подходит).
2. **Сборка.** В фоне (Bash с `run_in_background`) из корня репозитория:

   ```bash
   CI=true pnpm i --frozen-lockfile && pnpm run demos:prepare
   ```

   Это занимает от 1 до 15 минут, в зависимости от кэша Nx. `demos:prepare` сам собирает DevExtreme, упаковывает
   обёртки и кладёт бандлы в `apps/demos/node_modules/devextreme-dist/css/`. Предупреждения Rollup про
   `openai/*.mjs` — не ошибки.
3. **Сервер.** Запускай во вкладке терминала через `run_in_terminal`, чтобы пользователь мог его остановить:

   ```bash
   export PATH="/opt/homebrew/opt/node@24/bin:$PATH" && pnpm run demos:start
   ```

После правок SCSS темы снова выполни `pnpm run demos:prepare` и обнови страницу.

## Открыть демку с темой Fluent Next

Оболочка `http://localhost:8080/#Demos/…` показывает демку в iframe и не перезагружает его при смене hash.
Для осмотра открывай демку напрямую, а тему задавай cookie:

```js
// javascript_tool на любой странице localhost:8080
document.cookie = 'dx-demo-theme=dx.fluent-next.blue.light.css; path=/';
```

Потом `navigate` → `http://localhost:8080/Demos/<Widget>/<Demo>/jQuery/`, например
`/Demos/Button/PredefinedTypes/jQuery/`. Список демок — `ls apps/demos/Demos/<Widget>/`. Проверь, что подключилась
нужная тема: `[...document.styleSheets].map(s => s.href).filter(Boolean)`.

| Нужно | Cookie |
|---|---|
| default, светлая | `dx.fluent-next.blue.light.css` |
| compact | `dx.fluent-next.blue.light.compact.css` |
| тёмная | `dx.fluent-next.blue.dark.css` |

**Лимит запросов.** Сервер пропускает не больше 100 загрузок страниц демок за 15 минут (`express-rate-limit` в
`apps/demos/utils/shell/server.js`). Поэтому собирай всё нужное за одну загрузку страницы, а не перезагружай её в
цикле. После лимита сервер отвечает 429, и тогда остаётся только ждать.

Если подходящей демки нет, создай виджет на открытой странице прямо из JS. jQuery-демки подключают
`dx.all.js`, поэтому `DevExpress.ui.<dxWidget>` доступен:

```js
const host = document.createElement('div'); document.body.appendChild(host);
const w = new DevExpress.ui.dxButton(host, { text: 'Save', icon: 'save', type: 'default', stylingMode: 'outlined' });
// … осмотр …
w.dispose(); host.remove();
```

## Осмотр: DOM и вычисленные стили

```js
// javascript_tool; ROOT — корневой класс виджета
const ROOT = '.dx-button';
const el = document.querySelector(ROOT);
const pick = (e) => { const cs = getComputedStyle(e); return {
  tag: e.tagName.toLowerCase(), cls: [...e.classList].join(' '), box: `${e.offsetWidth}x${e.offsetHeight}`,
  bg: cs.backgroundColor, color: cs.color, border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
  radius: cs.borderRadius, padding: cs.padding, margin: cs.margin, gap: cs.gap,
  font: `${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily.split(',')[0]}`, letterSpacing: cs.letterSpacing,
  shadow: cs.boxShadow, outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor} / ${cs.outlineOffset}` }; };
const walk = (e, d = 0) => [{ d, ...pick(e) }, ...[...e.children].flatMap((c) => walk(c, d + 1))];
walk(el);
```

Значение токена: `getComputedStyle(el).getPropertyValue('--dx-button-height')`. Токены публикуются на корне
виджета, поэтому читать их нужно с корня. Единицы — `rem` (1rem = 16px), а в Foundation значения в px:
`2rem` = 32 = `spacing/320`.

## Состояния

DevExtreme ставит состояния классами, поэтому их можно форсировать без мыши:

```js
const states = ['', 'dx-state-hover', 'dx-state-focused', 'dx-state-active', 'dx-state-disabled'];
const out = {};
for (const s of states) { if (s) el.classList.add(s); out[s || 'rest'] = walk(el); if (s) el.classList.remove(s); }
out;
```

- **Куда ставить класс.** У некоторых виджетов классы состояний живут не на корне: у элементов списков, у
  иконки чекбокса. Смотри селекторы в колонке «read by» таблицы токенов.
- **Выбор** — классы `dx-item-selected` / `dx-state-selected`, readonly — `dx-state-readonly`.
- **Рамка фокуса** (`--dx-focus-rect-*`) от одного класса не появляется: нужен настоящий фокус с клавиатуры
  (`:focus-visible`). Нажми Tab через `computer`, пока фокус не дойдёт до элемента, и сделай скриншот.

## Скриншоты для сравнения

Сделай скриншот области виджета в каждом состоянии и режиме через `computer` → `zoom` по координатам элемента
(`el.getBoundingClientRect()`). Подпиши, что на каждом. В шаге проверки эти скриншоты кладутся рядом с превью
из Figma.
