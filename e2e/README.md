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
| `header-back` | стрелка «назад» в шапке экрана |
| `open-history-{index}` | кнопка «История» в строке упражнения тренировки |
| `program-screen` · `program-item-{index}` · `program-item-remove-{index}` | экран программы: состав |
| `program-color-{ключ палитры}` · `program-add-exercise` · `program-duplicate` · `program-archive` | экран программы: цвет и действия |
| `exercise-history-screen` · `history-record-weight-value` · `history-record-weight-note` | история упражнения: рекорд веса |
| `history-metric-weight` · `history-metric-oneRm` · `history-chart` · `history-bar-peak-{index}` | история упражнения: график |
| `history-workout-{index}` · `history-delta-{index}` | история упражнения: раскладка по тренировкам |

Ключи палитры программ — `prog-red`, `prog-orange`, `prog-amber`, `prog-green`,
`prog-teal`, `prog-blue`, `prog-violet`, `prog-pink` (§7.3 ТЗ).

Maestro сопоставляет `id` и текст **регулярным выражением**, поэтому `+`, `(`, `)`
в названиях экранируются: `program-row-Грудь \+ трицепс \(копия\)`.

## Чего пока нет в коде

Список расхождений контракта и интерфейса — сценарии зелёными не станут, пока
эти идентификаторы не появятся:

| Нужно | Почему нет |
| --- | --- |
| `calendar-day-today` · `calendar-day-plus-N` · `calendar-day-minus-N` · `workout-card-today` | в коде идентификаторы дня и карточки строятся из даты (`calendar-day-2026-08-12`, `workout-card-2026-08-12`), относительных синонимов нет |
| `absence-end-date` и весь ввод отсутствия | экран добавления отсутствия не написан, календарь только показывает готовые периоды |
| `workout-item-{index}` | у карточки упражнения в тренировке нет своего `testID`, есть только `item-checkbox-{index}`, `add-set-{index}` и `open-history-{index}` |
| маршруты `/workout/new` и `/workout/{id}` | таббар и календарь уже ведут на них (`router.push('/workout/new?date=…')`), но самих экранов ещё нет; на них держатся `full-cycle`, `crash-resilience` и `exercise-history` |

Экраны программы, истории и тренировки лежат поверх таббара отдельным стеком,
поэтому вернуться в раздел можно только через `header-back`, а не тапом по табу.

Плитки статистики держат подпись и значение в одном узле, поэтому
`copyTextFrom` стоит брать с `stat-per-week-value`, а не с `stat-per-week`.

## Что проверяет каждый сценарий

| Файл | Сценарий | Из ТЗ |
| --- | --- | --- |
| `full-cycle.yaml` | путь от пустого приложения до статистики | критерии приёмки 1–3 |
| `crash-resilience.yaml` | подходы переживают убийство процесса | §7.1, критерий 11 |
| `export-import.yaml` | экспорт, полная очистка, импорт | FR-7.1, FR-7.2, критерий 10 |
| `absence-regularity.yaml` | отпуск не портит регулярность | FR-1.4, §5.3, критерий 7 |
| `language-switch.yaml` | смена языка на лету | FR-7.6 |
| `program-edit.yaml` | правка и дублирование программы не задевают проведённую тренировку | FR-3.5, FR-3.6 |
| `exercise-history.yaml` | рекорд веса, раскладка подходов, дельта к прошлому разу, график 1ПМ | FR-5.1–FR-5.4 |
