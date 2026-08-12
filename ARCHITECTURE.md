# 🏗️ Архитектура

Документ описывает, как устроен код дневника тренировок и почему именно так. Требования — в [TZ.md](TZ.md).

**Главный принцип:** зависимости направлены внутрь, к ядру с бизнес-правилами. База, файлы, часы и React подключаются снаружи через интерфейсы, а не вшиты в логику.

---

## 1. Слои

```
┌─────────────────────────────────────────────────────────────┐
│  ui/            экраны, компоненты, тема, i18n, навигация   │
│                 знает: app, типы domain                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ вызывает сценарии
┌───────────────────────────▼─────────────────────────────────┐
│  app/           сценарии + ports (интерфейсы зависимостей)  │
│                 знает: domain                               │
└───────────────────────────┬─────────────────────────────────┘
                            │ применяет правила
┌───────────────────────────▼─────────────────────────────────┐
│  domain/        типы и чистые правила расчётов (§5 ТЗ)      │
│                 не знает ничего: ноль внешних импортов      │
└─────────────────────────────────────────────────────────────┘
                            ▲ реализует ports
┌───────────────────────────┴─────────────────────────────────┐
│  infra/         SQLite, файлы, часы, id, бэкапы             │
│                 единственный слой, знающий про expo-*       │
└─────────────────────────────────────────────────────────────┘
                            ▲
                    composition root (провайдеры)
```

**Правило зависимостей.** `domain` не импортирует ничего. `app` импортирует только `domain`. `infra` реализует интерфейсы из `app/ports`. `ui` вызывает `app` и использует типы `domain`. Про `infra` знает только точка сборки. Правило проверяется `eslint-plugin-boundaries` и ломает CI при нарушении — это не договорённость, а ограничение сборки.

---

## 2. Структура папок

```
src/
├── domain/                     чистый TypeScript, тестируется без эмулятора
│   ├── model/                  Exercise, Program, Workout, WorkoutSet, Absence, Settings
│   ├── rules/
│   │   ├── duration.ts         §5.1: начало/конец, задним числом, ручное время, выброс >6 ч
│   │   ├── completion.ts       §5.2: доля выполненных → цветовой токен
│   │   ├── metrics.ts          §5.3: 1ПМ по Эпли, тренировок в неделю с вычетом отпуска
│   │   ├── streak.ts           серии недель, отпуск не прерывает
│   │   ├── units.ts            кг ↔ фунты, округление до 0.5 кг / 1 lb
│   │   └── dates.ts            локальная календарная дата, границы недель, DST
│   ├── transfer/               схема экспорта и правила слияния при импорте
│   └── errors.ts               WorkoutDateTaken, DuplicateExerciseName, EmptyProgramName…
│
├── app/
│   ├── ports/                  интерфейсы, а не реализации
│   │   ├── repositories.ts     ExerciseRepo, ProgramRepo, WorkoutRepo, AbsenceRepo
│   │   ├── settings.ts         SettingsStore
│   │   ├── files.ts            FileGateway: pick, write, share
│   │   ├── clock.ts            Clock: now()
│   │   ├── ids.ts              IdGenerator: uuid()
│   │   └── unitOfWork.ts       транзакция на несколько таблиц
│   ├── usecases/
│   │   ├── workouts/           createWorkout, addSet, toggleItemDone, editTimes, deleteWorkout
│   │   ├── programs/           createProgram, reorderItems, duplicateProgram, archiveProgram
│   │   ├── exercises/          createExercise, archiveExercise
│   │   ├── stats/              monthStats, yearStats, exerciseHistory
│   │   └── data/               exportAll, importAll, rotateBackups
│   └── container.ts            фабрика: получает порты → отдаёт готовые сценарии
│
├── infra/                      единственное место с expo-* и SQL
│   ├── db/
│   │   ├── schema.ts           таблицы Drizzle по §6 ТЗ
│   │   ├── migrations/         версионированные, применяются при старте
│   │   └── repositories/       реализации портов
│   ├── files/                  expoFileGateway (expo-file-system, document-picker, sharing)
│   └── system/                 systemClock, uuidGenerator, keepAwake
│
└── ui/
    ├── screens/                13 экранов из макета
    ├── components/             Donut, ExerciseRow, WorkoutCard, TabBar, Stepper
    ├── theme/                  токены из фрейма дизайн-системы, провайдер тем
    ├── i18n/                   ru.ts, en.ts, plural.ts, useT()
    ├── hooks/                  useMonthCalendar, useActiveWorkout — обёртки над сценариями
    └── providers/              ServicesProvider — точка сборки контейнера
```

---

## 3. Ключевые интерфейсы

```ts
// app/ports/repositories.ts
export interface WorkoutRepo {
  byDate(date: LocalDate): Promise<Workout | null>
  byId(id: Id): Promise<WorkoutAggregate | null>
  listRange(from: LocalDate, to: LocalDate): Promise<WorkoutSummary[]>
  insert(workout: NewWorkout, items: NewWorkoutItem[]): Promise<Id>
  addSet(set: NewSet): Promise<Id>
  setItemCompleted(itemId: Id, at: Instant | null): Promise<void>
}

// app/ports/clock.ts — без инжекции часов тесты длительности недетерминированы
export interface Clock { now(): Instant }
```

```ts
// app/usecases/workouts/createWorkout.ts
// снапшот программы (FR-3.5) живёт в сценарии — не в репозитории и не в компоненте
export const createWorkout = (d: Deps) => async (input: {date: LocalDate; programId: Id}) => {
  if (await d.workouts.byDate(input.date)) throw new WorkoutDateTaken(input.date)
  const program = await d.programs.byIdWithItems(input.programId)
  return d.uow.tx(async () =>
    d.workouts.insert(
      { id: d.ids.uuid(), date: input.date, startedAt: d.clock.now(),
        programId: program.id, programName: program.name, programColor: program.color },
      program.items.map((it, i) => ({ id: d.ids.uuid(), exerciseId: it.exerciseId,
        exerciseName: it.exercise.name, order: i, isAdHoc: false })),
    ),
  )
}
```

---

## 4. Принятые решения

| Вопрос | Решение | Почему |
| --- | --- | --- |
| Источник истины | **База.** Копии данных в глобальном сторе нет | Иначе рассинхрон и потерянные подходы после перезапуска |
| Доступ к данным | **Drizzle ORM** поверх `expo-sqlite` | Типизированная схема, генерация миграций, читаемые запросы для статистики |
| Реактивность UI | **TanStack Query**: `queryFn` вызывает сценарий, мутации инвалидируют ключи | Готовый кэш, состояния загрузки и ошибок; локальная база — такой же асинхронный источник, как сеть |
| Эфемерное состояние | Zustand: открытый шит, выбранный фильтр, режим календаря | Не смешивается с данными из базы |
| Единицы веса | В базе **всегда килограммы**, конвертация в форматтерах на границе UI | FR-7.5: переключение единиц не переписывает историю |
| Часы и id | Инжектируются портами `Clock` и `IdGenerator` | Детерминированные тесты; UUID не конфликтуют при импорте из другой копии |
| Транзакции | `unitOfWork.tx()` в порту | Тренировка и её упражнения пишутся атомарно |
| Импорт/экспорт | Схема и слияние — чистые функции в `domain/transfer`, файловый ввод-вывод — в `infra` | Правило «конфликт решается по свежему `updatedAt`» тестируется без файловой системы |
| Запись подходов | Сразу в базу, без кнопки «Сохранить» | §7.1: приложение переживает убийство процесса |
| Ошибки | Типизированные доменные ошибки → ключи i18n в UI | Компоненты не знают ни текстов, ни кодов ошибок SQLite |
| Контроль слоёв | `eslint-plugin-boundaries` в CI | Архитектура, которую не проверяют, разваливается за месяц |

---

## 5. Поток данных на примере

Пользователь жмёт «＋ подход»:

```
ui/screens/workout/AddSetSheet
   └─ useMutation(() => services.addSet({ workoutItemId, weightKg, reps }))
        └─ app/usecases/workouts/addSet
             ├─ domain/rules/units       нормализует вес в килограммы
             ├─ domain/validation        проверяет повторы > 0
             └─ ports.workouts.addSet    → infra/db/repositories/workoutRepo
                                              └─ Drizzle INSERT в transaction
   └─ invalidate(['workout', id]) → перерисовка карточки и бублика
```

Счётчик времени тренировки: чистая `formatElapsed(startedAt, now)` из `domain`, тикающая через `useInterval` в `ui`. В расчётах нет прямых обращений к `Date.now()`.

---

## 6. Как слои ложатся на тесты

| Слой | Чем подменяем окружение | Что покрываем |
| --- | --- | --- |
| `domain` | ничего не нужно | правила §5: длительность, завершённость, серии, 1ПМ, единицы, даты |
| `app/usecases` | фейковые репозитории в памяти, фиксированные часы | «вторая тренировка на дату», снапшот программы, слияние импорта |
| `infra/db` | SQLite in-memory | ограничения, каскады, миграции, экспорт-импорт |
| `ui` | контейнер с фейковыми сценариями | экраны и компоненты без базы и эмулятора |

Компонентные тесты не поднимают SQLite — ради этого и вводятся порты.

---

## 7. Чего не делаем

Логики в компонентах (расчёт длительности прямо в разметке) · SQL-запросов из экранов · репозитория на каждый экран · Redux с копией базы в памяти · общей свалки `utils/`, куда стекается бизнес-логика · снапшотных тестов на целые экраны.
