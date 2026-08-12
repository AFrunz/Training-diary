# Сквозные сценарии

Запускаются [Maestro](https://maestro.mobile.dev) на реальном устройстве или эмуляторе Android:

```sh
maestro test e2e/                # все сценарии
maestro test e2e/full-cycle.yaml # один
```

Сценариев намеренно мало: они медленные и хрупкие, поэтому покрывают только то,
что не проверить ниже — связку экранов, перезапуск процесса и работу с файлами.
Всё остальное живёт в модульных, сценарных и компонентных тестах.

## Контракт по `testID`

Сценарии опираются на идентификаторы, которые обязаны быть в интерфейсе.
Менять их можно только вместе со сценариями.

| `testID` | Где |
| --- | --- |
| `tab-calendar` · `tab-workouts` · `tab-library` · `tab-stats` · `tab-settings` | таббар |
| `library-segment-exercises` · `library-segment-programs` | переключатель разделов библиотеки |
| `add-button` | круглая кнопка «＋» в шапке раздела |
| `name-input` | поле названия на экранах создания |
| `create-button` | кнопка подтверждения на экранах создания |
| `exercise-picker-open` · `exercise-picker-done` · `exercise-row-{name}` | выбор упражнений в состав программы |
| `program-row-{name}` · `exercise-row-{name}` | строки списков |
| `calendar-day-{YYYY-MM-DD}` | день в календаре месяца |
| `workout-timer` | счётчик времени в шапке тренировки |
| `workout-item-{index}` · `item-checkbox-{index}` · `add-set-{index}` | упражнение в тренировке |
| `set-weight-input` · `set-reps-input` · `set-submit` | шит добавления подхода |
| `workout-donut` · `workout-card-{YYYY-MM-DD}` | список тренировок |
| `stat-workouts` · `stat-per-week` · `stat-completion` | плитки статистики |
| `settings-export` · `settings-import` · `settings-wipe` · `settings-language` | настройки |

## Что проверяет каждый сценарий

| Файл | Сценарий | Из ТЗ |
| --- | --- | --- |
| `full-cycle.yaml` | путь от пустого приложения до статистики | критерии приёмки 1–3 |
| `crash-resilience.yaml` | подходы переживают убийство процесса | §7.1, критерий 11 |
| `export-import.yaml` | экспорт, полная очистка, импорт | FR-7.1, FR-7.2, критерий 10 |
| `absence-regularity.yaml` | отпуск не портит регулярность | FR-1.4, §5.3, критерий 7 |
| `language-switch.yaml` | смена языка на лету | FR-7.6 |
