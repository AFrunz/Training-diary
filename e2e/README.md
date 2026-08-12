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
| `library-screen` · `library-segment-exercises` · `library-segment-programs` | библиотека и переключатель разделов |
| `library-search` · `library-sort-alphabet` · `library-sort-frequency` · `library-sort-date` · `library-empty` | поиск, сортировка и пустое состояние библиотеки |
| `add-button` | круглая кнопка «＋» в шапке раздела |
| `name-input` | поле названия на экранах создания |
| `create-button` | кнопка подтверждения на экранах создания |
| `name-free` · `name-error` | живая проверка имени упражнения (FR-2.1.1) |
| `muscle-group-{ключ}` · `note-input` | группа мышц и заметка нового упражнения |
| `program-color-{ключ}` · `program-item-{index}` | цвет и состав новой программы |
| `exercise-picker-open` · `exercise-picker-done` · `exercise-row-{name}` | выбор упражнений в состав программы |
| `exercise-picker-counter` · `exercise-picker-create` | счётчик выбранных и создание упражнения из шита |
| `program-row-{name}` · `exercise-row-{name}` | строки списков |
| `calendar-screen` · `calendar-day-{YYYY-MM-DD}` · `calendar-dot-{YYYY-MM-DD}` | день в календаре месяца и точка программы в нём |
| `calendar-create-workout` · `calendar-continue-workout` · `legend-absence` | карточка «сегодня» и легенда календаря |
| `program-option-{название}` | выбор программы при создании тренировки |
| `workout-timer` | счётчик времени в шапке тренировки |
| `item-checkbox-{index}` · `add-set-{index}` · `open-history-{index}` · `item-target-{index}` | упражнение в тренировке |
| `set-weight-input` · `set-reps-input` · `set-submit` | шит добавления подхода |
| `workouts-screen` · `workouts-empty` · `workout-card-{YYYY-MM-DD}` · `workout-donut-{YYYY-MM-DD}` | список тренировок |
| `filter-chip-all` · `filter-chip-{название программы}` | фильтры списка тренировок |
| `active-workout-card` | закреплённая незавершённая тренировка сегодня |
| `stats-screen` · `stat-workouts` · `stat-per-week` · `stat-duration` · `stat-completion` | плитки статистики |
| `stats-mode-month` · `stats-mode-year` | сегмент «Месяц»/«Год» |
| `stats-prev` · `stats-next` · `stats-period` | переключение периода |
| `stat-workouts-value` · `stat-per-week-value` · `stat-duration-value` · `stat-completion-value` | значения плиток, «—» вместо нуля (FR-6.4) |
| `stat-bar-{index}` · `stats-programs-bar` · `stats-streak` | график недель, распределение, серия |
| `settings-screen` · `settings-export` · `settings-import` · `settings-wipe` · `settings-language` | настройки |
| `settings-export-subtitle` · `settings-wipe-subtitle` · `settings-language-value` | подсказки и значения строк настроек |
| `settings-unit-kg` · `settings-unit-lb` · `settings-theme` · `settings-theme-value` | единицы веса и тема |
| `header-back` | стрелка «назад» в шапке экрана |
| `program-screen` · `program-item-{index}` · `program-item-remove-{index}` | экран программы: состав |
| `program-color-{ключ палитры}` · `program-add-exercise` · `program-duplicate` · `program-archive` | экран программы: цвет и действия |
| `exercise-history-screen` · `history-record-weight-value` · `history-record-weight-note` | история упражнения: рекорд веса |
| `history-metric-weight` · `history-metric-oneRm` · `history-chart` · `history-bar-peak-{index}` | история упражнения: график |
| `history-workout-{index}` · `history-delta-{index}` | история упражнения: раскладка по тренировкам |

Ключи палитры программ — `prog-red`, `prog-orange`, `prog-amber`, `prog-green`,
`prog-teal`, `prog-blue`, `prog-violet`, `prog-pink` (§7.3 ТЗ).

Идентификаторы дней и карточек тренировок строятся из даты, относительных
синонимов вроде `calendar-day-today` в коде нет. Дата считается в сценарии
и подставляется в селектор:

```yaml
- evalScript: ${output.today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)}
- assertVisible:
    id: 'workout-card-${output.today}'
```

Maestro сопоставляет `id` и текст **регулярным выражением**, поэтому `+`, `(`, `)`
в названиях экранируются: `program-row-Грудь \+ трицепс \(копия\)`.

## Чего пока нет в коде

Список расхождений контракта и интерфейса — сценарии зелёными не станут, пока
это не появится:

| Нужно | Почему нет | Кто ждёт |
| --- | --- | --- |
| весь ввод отсутствия: долгое нажатие по дню, экран отсутствия, `absence-end-date` | экран не написан, сценария создания отсутствия в `src/app` нет; календарь только показывает готовые периоды и легенду `legend-absence` | `absence-regularity` (не запускается целиком) |
| полное удаление данных и импорт из файла | `app/(tabs)/settings.tsx` не передаёт `onWipeConfirmed` и `onImportRequested`, сценария удаления в `src/app` нет, выбора файла и режима импорта («Заменить всё» / «Дополнить») в интерфейсе тоже нет | `export-import` (проходит только до экспорта) |
| `workout-card-today` · `calendar-day-minus-N` · `workout-date` | относительных дат нет (см. выше), а поля выбора даты на экране новой тренировки не существует: дата приходит параметром маршрута (`/workout/new?date=…`) | `program-edit`, `settings-preferences`, `exercise-history`, `fixtures/seed-stats` |

Экраны программы, истории, новой тренировки и самой тренировки лежат поверх
таббара отдельным стеком, поэтому вернуться в раздел можно только через
`header-back`, а не тапом по табу. По этой же причине фикстуры `seed-program`
и `seed-workout` заканчиваются возвратом: созданная программа открывается
через `replace`, и без «назад» следующий шаг не достучится до вкладок.

Незавершённая сегодняшняя тренировка закреплена сверху списка под
`active-workout-card`; `workout-card-{дата}` появляется у неё только после того,
как отмечены все упражнения.

Подпись и значение плитки статистики лежат в разных узлах, поэтому
`copyTextFrom` берётся с `stat-per-week-value`, а не с `stat-per-week`.

## Что проверяет каждый сценарий

| Файл | Сценарий | Из ТЗ |
| --- | --- | --- |
| `full-cycle.yaml` | путь от пустого приложения до статистики | критерии приёмки 1–3 |
| `crash-resilience.yaml` | подходы переживают убийство процесса | §7.1, критерий 11 |
| `export-import.yaml` | экспорт, полная очистка, импорт | FR-7.1, FR-7.2, критерий 10 |
| `absence-regularity.yaml` | отпуск не портит регулярность | FR-1.4, §5.3, критерий 7 |
| `language-switch.yaml` | смена языка на лету | FR-7.6 |
| `library-create.yaml` | упражнение и программа с нуля | FR-2.1.1, FR-3.1.1, FR-3.1.2 |
| `workouts-filter.yaml` | фильтр списка тренировок и бейдж «Идёт» | FR-3.7, §5.2 |
| `stats-period.yaml` | метрики, прочерки, переключение периода | FR-6.2, FR-6.4 |
| `settings-preferences.yaml` | единицы веса, тема, секции настроек | FR-7.4, FR-7.5 |
| `program-edit.yaml` | правка программы не задевает проведённые тренировки | FR-3.5, FR-3.6 |
| `exercise-history.yaml` | рекорды, дельты и график истории | FR-5.2, FR-5.3 |
| `workout-session.yaml` | проведение тренировки от создания до завершения | FR-4.1, FR-4.4, FR-4.5 |

`absence-regularity.yaml` не запускается: ввода отсутствия в интерфейсе нет,
файл держим как контракт к будущему экрану (см. комментарий в начале сценария).
