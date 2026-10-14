# Для разработчиков: где кит взял значения из Foundation tokens

Сюда скилл `fluent-next-ui-kit` записывает пограничные случаи, которые решили через токены Foundation. Это
места, где в коде темы Fluent Next значение выражено не через дизайн-токен: `calc()`, `em`, литерал,
`color-mix()`, или у компонента нет своего токена. В Figma такое значение взяли из Foundation tokens: алиасом
компонентного токена, прямой привязкой поля или стилем эффекта.

Каждая запись — предложение разработчикам выразить то же значение через дизайн-токены. Тогда кит и код будут
совпадать по смыслу, а не только по пикселям.

- **Статусы:** 🔸 открыто — ждёт решения разработчиков; ✅ сделано — тема поправлена или решили оставить как есть
  (подробности в «Итог»).
- **Файл ведёт скилл.** Вручную правьте только «Статус» и «Итог», или попросите агента:
  `registry.mjs resolve foundation <#> --note "…"`.

| # | Компонент | Где в Figma | В коде темы | Взяли в Figma | Предложение разработчикам | Статус | Итог | Ветка | Кто | Дата |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Button <!-- key:button~button/content-padding --> | button/content-padding | `--dx-button-content-padding: calc((var(--dxds-spacing-320) - var(--dxds-spacing-200) - var(--dxds-border-width-10) * 2) / 2)` (.dx-button .dx-button-content, padding) | `spacing/50` (5px) default, `spacing/30` (3px) compact | выразить через ступени var(--dxds-spacing-50) / var(--dxds-spacing-30) вместо calc | 🔸 открыто |  | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/cr0GOmHQkrzG5hWtatoOYZ/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-08 |
| 2 | .Label <!-- key:.label~text_fontweight --> | text › fontWeight | `.dx-widget { font-weight: 400 }` — у .dx-texteditor-label своего токена начертания нет | `font-weight/base-default` (400) | опубликовать токен начертания label (например --dx-text-editor-label-font-weight) или читать var(--dxds-font-weight-base-default) | 🔸 открыто |  | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/vHIhmv2MFId7VpMItdxVEM/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 |
| 3 | .DropDownButton <!-- key:.dropdownbutton~text-editor/spin-button-margin-inline-end --> | text-editor/spin-button-margin-inline-end | `--dx-text-editor-spin-button-margin-inline-end: calc(var(--dxds-spacing-120) / 2)` (.dx-texteditor-buttons-container:last-child > .dx-dropdowneditor-button:last-child, margin-inline-end) | `spacing/60` (6px) default, `spacing/40` (4px) compact | выразить через var(--dxds-spacing-60) / var(--dxds-spacing-40) вместо calc. В ките временно нарисован как paddingRight внутри .DropDownButton — перенести на контейнер кнопок при сборке .TextEditor | 🔸 открыто |  | [ветка](https://www.figma.com/design/DpK8J5xUCl7Gc70DKC4I1K/branch/0o4awgvrtUueilfLooFELH/DevExtreme-UI-Kit--AI-Generated-) | Ekaterina Pochinshchikova | 2026-10-14 |
