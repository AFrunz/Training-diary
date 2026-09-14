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
| `new-program-screen` · `program-color-{ключ}` · `program-item-{index}` | экран новой программы: цвет и состав |
| `exercise-picker-open` · `exercise-picker-done` · `exercise-row-{name}` | выбор упражнений в состав программы |
| `exercise-picker-counter` · `exercise-picker-create` | счётчик выбранных и создание упражнения из шита |
| `program-row-{name}` · `exercise-row-{name}` | строки списков |
| `calendar-screen` · `calendar-day-{YYYY-MM-DD}` · `calendar-dot-{YYYY-MM-DD}` | день в календаре месяца и точка программы в нём |
| `calendar-create-workout` · `calendar-continue-workout` · `legend-absence` | карточка «сегодня» и легенда календаря |
| `program-option-{название}` | выбор программы при создании тренировки |
| `workout-timer` | счётчик времени в шапке тренировки |
| `workout-delete` · `delete-workout-confirm` · `delete-workout-cancel` | удаление тренировки и диалог подтверждения |
| `item-checkbox-{index}` · `add-set-{index}` · `open-history-{index}` · `item-target-{index}` | упражнение в тренировке |
| `add-exercise` | добавить упражнение сверх программы: открывает тот же шит выбора (FR-4.6) |
| `set-chip-{index}-{номер}` · `set-previous-{index}-{номер}` · `set-missing-{index}-{номер}` | пары подходов: сегодняшний (тап открывает правку), прошлой тренировки, пустая рамка вместо недоделанного |
| `workout-sets-hint` | пояснение «сверху — прошлая тренировка, снизу — сегодняшняя» |
| `set-weight-input` · `set-reps-input` · `set-submit` | шит добавления подхода |
| `set-unit-kg` · `set-unit-lb` · `set-unit-deg` · `set-delete` | единица подхода и удаление в режиме правки |
| `set-weight-minus` · `set-weight-plus` · `set-reps-minus` · `set-reps-plus` | степперы шита: вес шагает на 2.5 кг, фунты — на 5, угол — на 5° |
| `workouts-screen` · `workouts-empty` · `workout-card-{YYYY-MM-DD}` · `workout-donut-{YYYY-MM-DD}` | список тренировок |
| `filter-chip-all` · `filter-chip-{название программы}` | фильтры списка тренировок |
| `active-workout-card` | закреплённая незавершённая тренировка сегодня |
| `stats-screen` · `stat-workouts` · `stat-per-week` · `stat-duration` · `stat-completion` | плитки статистики |
| `stats-mode-month` · `stats-mode-year` | сегмент «Месяц»/«Год» |
| `stats-prev` · `stats-next` · `stats-period` | переключение периода |
| `stat-workouts-value` · `stat-per-week-value` · `stat-duration-value` · `stat-completion-value` | значения плиток, «—» вместо нуля (FR-6.4) |
| `stat-bar-{index}` · `stats-programs-bar` · `stats-streak` | график недель, распределение, серия |
| `settings-screen` · `settings-export` · `settings-import` · `settings-backups` · `settings-units` · `settings-language` | настройки |
| `settings-export-subtitle` · `settings-wipe-subtitle` · `settings-language-value` | подсказки и значения строк настроек |
| `settings-unit-kg` · `settings-unit-lb` · `settings-theme` · `settings-theme-value` | единицы веса и тема |
| `settings-wipe` · `settings-wipe-slider` · `settings-wipe-knob` · `settings-wipe-confirm` | опасная зона: пояснение, ползунок с ручкой и кнопка подтверждения |
| `backups-screen` · `backups-row-{N}` · `backups-row-{N}-subtitle` · `backups-restore-{N}` | список автобэкапов: строка копии и восстановление |
| `backups-create` · `backups-empty` | «снять копию сейчас» и пустое состояние списка копий |
| `header-back` | стрелка «назад» в шапке экрана |
| `program-screen` · `program-name-input` · `program-item-{index}` · `program-item-remove-{index}` | экран программы: название и состав |
| `program-item-up-{index}` · `program-item-down-{index}` | порядок в составе: у первой строки недоступна «вверх», у последней — «вниз» |
| `program-color-{ключ палитры}` · `program-add-exercise` · `program-duplicate` · `program-archive` | экран программы: цвет и действия |
| `exercise-history-screen` · `history-record-weight-value` · `history-record-weight-note` | история упражнения: рекорд веса |
| `history-metric-weight` · `history-metric-oneRm` · `history-metric-volume` · `history-chart` · `history-bar-peak-{index}` | история упражнения: график и его метрики |
| `history-workout-{index}` · `history-delta-{index}` · `history-volume-delta-{index}` | история упражнения: раскладка по тренировкам и плашки изменений |

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

Удаление всех данных вторым нажатием не подтверждается: строка `settings-wipe`
только объясняет, а решает ползунок. Его нужно протянуть до правого края —
после этого вместо дорожки появляется кнопка `settings-wipe-confirm`, и стирает
данные уже она. У дорожки роль `adjustable` (экранный диктор доводит ползунок
действием «увеличить»), а в сценарии это жест:

```yaml
- swipe:
    from:
      id: 'settings-wipe-knob'
    direction: RIGHT
- tapOn:
    id: 'settings-wipe-confirm'
```

Свайп начинается от ручки, а не от середины дорожки: Maestro ведёт палец от
элемента до 90 % ширины экрана, и от центра `settings-wipe-slider` полного хода
не наберётся — ползунок вернётся назад, а кнопка подтверждения не появится.

## Чего пока нет в коде

Список расхождений контракта и интерфейса — сценарии зелёными не станут, пока
это не появится:

| Нужно | Почему нет | Кто ждёт |
| --- | --- | --- |
| `calendar-day-minus-N` · `workout-date` | относительных дат в идентификаторах нет (см. выше), а поля выбора даты на экране новой тренировки не существует: дата приходит параметром маршрута (`/workout/new?date=…`), куда ведёт тап по дню календаря | `exercise-history`, `fixtures/seed-stats` |
| выбор файла при импорте | `pickJson` открывает системный выбор файла, а выгрузка уходит в системное «Поделиться» и в известном месте не лежит: указать её шагом Maestro нечем. Всё до этого выведено — `app/(tabs)/settings.tsx` передаёт и `onImportRequested` (режим «Заменить всё» / «Дополнить»), и `onWipeConfirmed` | `export-import` (проходит до выбора режима импорта) |
| выбор дня для дат отсутствия | экран отсутствия есть: долгое нажатие по дню календаря ведёт на `/absence/new`, там `absence-type-{тип}`, `absence-start-date`, `absence-end-date`, `absence-note`, `absence-save`. Но даты — текстовые поля `YYYY-MM-DD` (`inputText`), а сценарий написан под выбор дня в календаре | `absence-regularity` (шаги ввода дат устарели) |

Экраны программы, новой программы, истории, новой тренировки, самой тренировки,
отсутствия и автобэкапов лежат поверх таббара отдельным стеком, поэтому
вернуться в раздел можно только через `header-back`, а не тапом по табу.
По этой же причине фикстуры `seed-program` и `seed-workout` заканчиваются
возвратом: созданная программа открывается через `replace`, и без «назад»
следующий шаг не достучится до вкладок.

Дублирование программы (`program-duplicate`) копию сразу не создаёт: оно
открывает экран создания с подставленными именем «… (копия)» и составом,
а копия появляется только после `create-button`. Открывается она через
`replace` поверх экрана оригинала, поэтому из копии в библиотеку — два
«назад».

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
| `backups.yaml` | ручная копия и восстановление после очистки | FR-7.3, FR-7.4 |
| `absence-regularity.yaml` | отпуск не портит регулярность | FR-1.4, §5.3, критерий 7 |
| `language-switch.yaml` | смена языка на лету | FR-7.6 |
| `library-create.yaml` | упражнение и программа с нуля | FR-2.1.1, FR-3.1.1, FR-3.1.2 |
| `workouts-filter.yaml` | фильтр списка тренировок и бейдж «Идёт» | FR-3.7, §5.2 |
| `stats-period.yaml` | метрики, прочерки, переключение периода | FR-6.2, FR-6.4 |
| `settings-preferences.yaml` | единицы веса, тема, секции настроек | FR-7.4, FR-7.5 |
| `program-edit.yaml` | порядок стрелками, дублирование через экран создания, снапшот состава у проведённой тренировки | FR-3.5, FR-3.6 |
| `exercise-history.yaml` | рекорды, дельты и график истории | FR-5.2, FR-5.3 |
| `workout-session.yaml` | проведение тренировки: подходы, правка по тапу, угол вместо веса, удаление | FR-4.1, FR-4.4, FR-4.4.1, FR-4.5, FR-4.11 |

`absence-regularity.yaml` пока не запускается: экран отсутствия в приложении
уже есть, но сам сценарий написан под выбор дня в календаре, а даты вводятся
строкой — шаги ввода ещё не переписаны (см. комментарий в начале сценария).

В `backups.yaml` пустого состояния `backups-empty` не увидеть: копия снимается
и при запуске приложения, поэтому к моменту прохода в списке уже есть хотя бы
одна строка. Ручная копия становится нулевой строкой — свежие идут сверху.
