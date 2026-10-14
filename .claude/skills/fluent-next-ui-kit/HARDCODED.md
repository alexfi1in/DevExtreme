# Реестр захардкоженных значений кита

Пограничные случаи, где решили захардкодить значение: сырое значение переменной или поле без привязки к токену.
Такое место выпадает из системы токенов: оно не меняется вместе с темой, режимом `size` или Foundation tokens.
Реестр нужен, чтобы ни одно такое место не потерялось и со временем каждое заменили токеном.

- **Статусы:** 🔸 открыто; ✅ сделано — хардкод заменён токеном или решили, что он не мешает (подробности в «Итог»).
- **Файл ведёт скилл.** Вручную правьте только «Статус» и «Итог», или попросите агента:
  `registry.mjs resolve hardcoded <#> --note "…"`.

| # | Компонент | Где в Figma | Значение | В коде темы | Почему не токен | Что нужно, чтобы убрать | Статус | Итог | Ветка | Кто | Дата |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | .SpinButtons <!-- key:.spinbuttons~root_height --> | (root) › height | 32 | `.dx-numberbox-spin-container { height: 100% }` — высота поля (30 у outlined/filled, 32 у underlined) | у высоты нет токена: блок растягивается на высоту поля | растягивать блок по родителю в мастере .TextEditor (сейчас Figma не принимает FILL там) | 🔸 открыто |  | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/7PYdXhvFOYOqAae8CTlD7V/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 |
| 2 | .SpinButtons <!-- key:.spinbuttons~.spinbuttons_/_button_fill_stateactive --> | .SpinButtons / Button › fill (state=active) | #e1e1e1 (сырое, светлая тема) | `.dx-numberbox-spin-button.dx-state-active { background-color: var(--dx-number-box-spin-bg-active) }` → var(--dxds-color-bg-active) | ветка смёржена до привязки: импорт color/bg-active из Foundation завис | создать number-box/spin-bg-active → color/bg-active и привязать фон 6 вариантов state=active (в тёмной теме сейчас неверный светлый цвет) | 🔸 открыто |  | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/7PYdXhvFOYOqAae8CTlD7V/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 |
