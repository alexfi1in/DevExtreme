# Чек-лист UI Kit · Fluent Next

Порядок работы над компонентами кита «DevExtreme UI Kit (AI Generated)» и кто что делает. Файл ведёт скилл
`fluent-next-ui-kit`: он меняет статус, когда берёт компонент в работу и когда заканчивает, и сразу пушит
изменение. Так все видят актуальное состояние, даже работая параллельно.

## Как читать

- **Порядок — снизу вверх по зависимостям.** `Ур. 0` — элементарные компоненты, внутри которых нет других
  компонентов кита. Компонент уровня N собран из компонентов уровней ниже N.
- **Компоненты одного уровня можно делать параллельно.** Внутри уровня выше стоят те, что чаще встречаются в
  других: они разблокируют больше.
- **Компонент можно брать в работу, когда все компоненты из колонки «Состоит из» смёржены.** Список доступных
  выдаёт `node .claude/skills/fluent-next-ui-kit/scripts/checklist.mjs next`.
- **Статусы:** ⬜ не начат → 🟦 в работе (ветка, кто) → 🟨 на ревью (агент закончил, ждёт дизайнера) →
  ✅ смёржен. ⛔ заблокирован — причина в заметке.
- **Ветки создают и мёржат дизайнеры.** Когда ветка смёржена, скажите агенту «<компонент> смёржен» или поправьте
  статус сами.
- **Ручные правки — только в колонках «Статус», «Ветка», «Кто», «Обновлено» и «Заметки».** Остальное
  перестраивается из графа компонентов (`scripts/figma/component-graph.js` → `checklist.mjs build`).

Граф собран из файла «DevExtreme UI Kit (AI Generated)» (`DpK8J5xUCl7Gc70DKC4I1K`) 2026-10-14.

## Компоненты кита

| # | Компонент | Ур. | Состоит из | Используется в | Статус | Ветка | Кто | Обновлено | Заметки |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Button <!-- key:page:0:1 --> | 0 | — | DataGrid, Chat, HtmlEditor, Calendar, Lookup, ButtonGroup, FileUploader, Popup, ActionSheet, Scheduler (in progress) | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/cr0GOmHQkrzG5hWtatoOYZ/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | 112 токенов button + font-size, global/font-family; 144 варианта по API, инстансы перепривязаны; открыто: тень normal contained в rest не видна; Utils перегенерировать |
| 2 | .Label <!-- key:set:73:3240 --> | 0 | — | ColorBox, DateBox, NumberBox, TextArea, TextBox, Autocomplete, DropDownBox, SelectBox, TagBox | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/vHIhmv2MFId7VpMItdxVEM/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | 11 токенов text-editor/*, 54 варианта (labelMode×stylingMode×state×validationStatus), набор перенесён на Subcomponents, 220 шрифтов в инстансах перепривязаны; Utils перегенерировать |
| 3 | .DropDownButton <!-- key:set:76:4437 --> | 0 | — | ColorBox, TagBox, .TextEditor | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/0o4awgvrtUueilfLooFELH/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | 4 токена (drop-down-editor/button-size, icon, icon-active + text-editor/spin-button-margin-inline-end), state=rest/active/disabled, набор на Subcomponents, 215 глифов перепривязаны; отступ справа временно внутри кнопки |
| 4 | CheckBox <!-- key:page:77:4807 --> | 0 | — | DataGrid, List, TreeView | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/KzYWjKAPOhDj0C4i49lsdy/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | 38 токенов check-box + global/content(-disabled); 36 вариантов value×state(+focused, read-only)×validationStatus; hasText/text; баг 24×16→16×16; Utils перегенерировать |
| 5 | .Badge <!-- key:set:237:8969 --> | 0 | — | Tab Panel, List | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/elMiH0i7X6LLYgOoSK1oxl/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | 8 токенов badge/*, state=rest/disabled + text, набор на Subcomponents, 337 шрифтов в инстансах перепривязаны; Utils перегенерировать |
| 6 | RadioButton <!-- key:page:669:7751 --> | 0 | — | RadioGroup, List | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/mgZ2ONCvAvFtaqFz9LXOON/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | 25 токенов radio-button + global/line-height; 24 варианта checked×state(+focused, read-only)×validationStatus; hasText/text; размеры кружка напрямую из Foundation; Utils перегенерировать |
| 7 | .Separator <!-- key:set:2188:19090 --> | 0 | — | ContextMenu, List | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/2DkhOUKmn4v33C8yKYSN3E/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | context(context-menu, list-select-all)×state; созданы menu/separator-bg(-disabled), context-menu/separator-height/-margin, list/base-select-all-separator-bg, list/select-all-height; Utils перегенерировать |
| 8 | Pagination <!-- key:page:237:58 --> | 0 | — | DataGrid, TreeList | ⛔ заблокирован | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/4mQvbdc71JA6cocp0tfVbT/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | отложен до SelectBox и NumberBox (compact собирается из них). Разобрано: prev/next внутри page-indexes; nav 33×30, без hover; margin пунктов как отступы корня Page Item; page-padding — сокращённая запись; first-child-* перекрыты в теме; info-content #444 |
| 9 | .Tag <!-- key:set:276:17674 --> | 0 | — | TagBox | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/Ljinl3IPJtItIHqFg5GxcP/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | 19 токенов tag-box (тег) + tag-remove-button-icon-size; state rest/hovered/focused/disabled, text, hasRemoveButton; кнопка удаления в потоке (резерв padding-inline-end), иконка close; Utils перегенерировать |
| 10 | .SpinButtons <!-- key:set:75:3984 --> | 0 | — | .TextEditor | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/7PYdXhvFOYOqAae8CTlD7V/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 |  |
| 11 | Load Indicator <!-- key:page:244:4 --> | 0 | — | Load Panel | 🟦 в работе | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/SzjU4F6XGEdJ2j0W9WeHfK/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-15 |  |
| 12 | .Informer <!-- key:set:358:8599 --> | 0 | — | Chat | ⬜ не начат |  |  |  |  |
| 13 | Bullet <!-- key:page:541:2 --> | 0 | — | DataGrid | ⬜ не начат |  |  |  |  |
| 14 | DropDownButton <!-- key:page:69:1499 --> | 0 | — | Scheduler (in progress) | ⬜ не начат |  |  |  |  |
| 15 | SpeechToText <!-- key:page:71:475 --> | 0 | — | Chat | ⬜ не начат |  |  |  |  |
| 16 | Accordion <!-- key:page:136:1514 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 17 | DateRangeBox <!-- key:page:324:2 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 18 | FloatingActionButton <!-- key:page:72:558 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 19 | Gallery <!-- key:page:368:2528 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 20 | Menu <!-- key:page:197:1938 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 21 | Popover <!-- key:page:164:2091 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 22 | Progress Bar <!-- key:page:269:2 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 23 | RangeSlider <!-- key:page:80:2180 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 24 | Slider <!-- key:page:80:2156 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 25 | Splitter <!-- key:page:379:2 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 26 | Stepper <!-- key:page:204:4395 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 27 | Switch <!-- key:page:77:4866 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 28 | Toast <!-- key:page:164:4109 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 29 | Tooltip <!-- key:page:164:4196 --> | 0 | — | — | ⬜ не начат |  |  |  |  |
| 30 | .TextEditor <!-- key:set:73:2488 --> | 1 | .SpinButtons, .DropDownButton | DateBox, NumberBox, TextBox, Autocomplete, DropDownBox, SelectBox, List | ⬜ не начат |  |  | 2026-10-14 | TODO: 1) отступ text-editor/spin-button-margin-inline-end перенести из .DropDownButton (paddingRight) на контейнер кнопок поля; 2) .DropDownButton и .SpinButtons в Surface мастера .TextEditor не приняли FILL по высоте (20 и 32) — растянуть на высоту поля |
| 31 | ContextMenu <!-- key:page:186:206 --> | 1 | .Separator | Chat | ⬜ не начат |  |  | 2026-10-14 |  |
| 32 | Popup <!-- key:page:164:3957 --> | 1 | Button | Scheduler (in progress) | ⬜ не начат |  |  |  |  |
| 33 | ActionSheet <!-- key:page:149:98 --> | 1 | Button | — | ⬜ не начат |  |  |  |  |
| 34 | ButtonGroup <!-- key:page:68:606 --> | 1 | Button | — | ⬜ не начат |  |  |  |  |
| 35 | Calendar <!-- key:page:164:4262 --> | 1 | Button | — | ⬜ не начат |  |  |  |  |
| 36 | ColorBox <!-- key:page:82:3343 --> | 1 | .Label, .DropDownButton | — | ⬜ не начат |  |  |  |  |
| 37 | FileUploader <!-- key:page:358:472 --> | 1 | Button | — | ⬜ не начат |  |  |  |  |
| 38 | Load Panel <!-- key:page:261:2 --> | 1 | Load Indicator | — | ⬜ не начат |  |  |  |  |
| 39 | RadioGroup <!-- key:page:77:4925 --> | 1 | RadioButton | — | ✅ смёржен | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/2gW0T3UdagC9hGq9wxxoNi/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 | 3 токена radio-group; 12 вариантов layout×state(rest, read-only, disabled)×validationStatus; horizontal gap = collection-horizontal-column-gap (17, в демке 16 — вопрос в DEV-HANDOFF); Utils перегенерировать |
| 40 | Tab Panel <!-- key:page:198:3510 --> | 1 | .Badge | — | ⬜ не начат |  |  | 2026-10-14 | TODO от .Badge: min-width 20 у бейджа во вкладке задаёт контейнер Tabs — учесть при сборке |
| 41 | TagBox <!-- key:page:304:2 --> | 1 | .Label, .Tag, .DropDownButton | — | ⬜ не начат |  |  |  |  |
| 42 | TextArea <!-- key:page:80:2022 --> | 1 | .Label | — | ⬜ не начат |  |  |  |  |
| 43 | TextBox <!-- key:page:73:3034 --> | 2 | .Label, .TextEditor | DataGrid, Lookup, TreeView | ⬜ не начат |  |  |  |  |
| 44 | List <!-- key:page:237:1466 --> | 2 | .Badge, CheckBox, RadioButton, .Separator, .TextEditor | SelectBox, Lookup | ⬜ не начат |  |  | 2026-10-14 |  |
| 45 | Autocomplete <!-- key:page:291:2 --> | 2 | .Label, .TextEditor | — | ⬜ не начат |  |  |  |  |
| 46 | Chat <!-- key:page:358:5937 --> | 2 | .Informer, Button, SpeechToText, ContextMenu | — | ⬜ не начат |  |  |  |  |
| 47 | DateBox <!-- key:page:77:4985 --> | 2 | .Label, .TextEditor | — | ⬜ не начат |  |  |  |  |
| 48 | DropDownBox <!-- key:page:453:26956 --> | 2 | .Label, .TextEditor | — | ⬜ не начат |  |  |  |  |
| 49 | NumberBox <!-- key:page:74:3566 --> | 2 | .Label, .TextEditor | — | ⬜ не начат |  |  |  |  |
| 50 | SelectBox <!-- key:page:76:4443 --> | 3 | .Label, .TextEditor, List | DataGrid, HtmlEditor | ⬜ не начат |  |  |  |  |
| 51 | Lookup <!-- key:page:276:18844 --> | 3 | TextBox, List, Button | — | ⬜ не начат |  |  |  |  |
| 52 | TreeView <!-- key:page:237:13810 --> | 3 | CheckBox, TextBox | — | ⬜ не начат |  |  | 2026-10-14 | TODO от CheckBox: 15 инстансов CheckBox с фиксированным размером 20×20 (контейнер чекбокса) — привязать к tree-view/checkbox-container-size |
| 53 | DataGrid <!-- key:page:521:3859 --> | 4 | CheckBox, Bullet, SelectBox, Button, TextBox, Pagination | TreeList | ⬜ не начат |  |  |  |  |
| 54 | HtmlEditor <!-- key:page:424:2 --> | 4 | Button, SelectBox | — | ⬜ не начат |  |  |  |  |
| 55 | TreeList <!-- key:page:572:2 --> | 5 | DataGrid, Pagination | — | ⬜ не начат |  |  |  |  |

## Ассеты

Иконки — общие ассеты, а не тематические компоненты. Компоненты используют их через подмену инстанса.

| # | Компонент | Ур. | Состоит из | Используется в | Статус | Ветка | Кто | Обновлено | Заметки |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Icons <!-- key:page:77:6511 --> | — | — | — | ⬜ не начат |  |  |  |  |

## Черновые страницы

Страницы после разделителя «IN PROGRESS». Берутся в работу, когда дизайнеры решат, что черновик готов.

| # | Компонент | Ур. | Состоит из | Используется в | Статус | Ветка | Кто | Обновлено | Заметки |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Charts (in progress) <!-- key:page:557:1013 --> | — | — | — | ⬜ не начат |  |  |  |  |
| 2 | Range Selector (in progress) <!-- key:page:404:4359 --> | — | — | — | ⬜ не начат |  |  |  |  |
| 3 | Scheduler (in progress) <!-- key:page:661:1709 --> | — | Button, DropDownButton, Popup | — | ⬜ не начат |  |  |  |  |
