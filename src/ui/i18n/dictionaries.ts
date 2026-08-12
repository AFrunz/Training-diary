import type { PluralForms } from './plural'

/**
 * Словари интерфейса (FR-7.6). Переводятся только строки приложения:
 * названия программ, упражнений и заметки — пользовательские данные и не трогаются.
 *
 * Ключи плоские и говорящие; форма множественного числа хранится объектом.
 */

export const ru = {
  'tab.calendar': 'Календарь',
  'tab.workouts': 'Тренировки',
  'tab.library': 'Библиотека',
  'tab.stats': 'Статистика',
  'tab.settings': 'Настройки',

  'calendar.month': 'Месяц',
  'calendar.year': 'Год',
  'calendar.absence': 'Отпуск',
  'calendar.today': 'Сегодня',
  'calendar.continueWorkout': 'Продолжить тренировку',

  'workout.inProgress': 'Идёт',
  'workout.startedAt': 'начата в {time}',
  'workout.addExercise': 'Добавить упражнение',
  'workout.addSet': '＋ подход',
  'workout.notFinished': 'не завершена',
  'workout.history': 'История упражнения',
  'workout.dateTaken': 'На эту дату тренировка уже есть',
  'workout.openExisting': 'Открыть существующую',

  'set.weight': 'Вес, кг',
  'set.weightLb': 'Вес, lb',
  'set.reps': 'Повторы',
  'set.previous': 'Прошлый раз: {value}',
  'set.submit': 'Добавить подход',
  'set.number': 'Подход {number}',

  'library.exercises': 'Упражнения',
  'library.programs': 'Программы',
  'library.search': 'Поиск упражнения',
  'library.sortAlphabet': 'По алфавиту',
  'library.sortFrequency': 'По частоте',
  'library.sortDate': 'По дате',
  'library.lastTime': 'последний раз {date}',

  'program.new': 'Новая программа',
  'program.name': 'Название',
  'program.namePlaceholder': 'Например, Грудь + трицепс',
  'program.nameHint': 'Название произвольное: «Грудь + трицепс», «День А», «Тяжёлая»',
  'program.color': 'Цвет программы',
  'program.composition': 'Состав',
  'program.empty': 'Пока пусто',
  'program.emptyHint': 'Добавьте упражнения из библиотеки или создайте новое',
  'program.create': 'Создать программу',
  'program.createDisabledHint': 'Кнопка станет активной, когда появится название',
  'program.duplicate': 'Дублировать',
  'program.archive': 'В архив',

  'exercise.new': 'Новое упражнение',
  'exercise.namePlaceholder': 'Например, Жим лёжа узким хватом',
  'exercise.nameFree': 'Такого упражнения ещё нет',
  'exercise.muscleGroup': 'Группа мышц',
  'exercise.note': 'Заметка',
  'exercise.noteOptional': 'необязательно',
  'exercise.notePlaceholder': 'Техника, ощущения, настройки тренажёра',
  'exercise.create': 'Создать упражнение',
  'exercise.weightHint': 'Вес в подходе можно не заполнять — для турника, брусьев и планки',

  'stats.workouts': 'Тренировок',
  'stats.perWeek': 'В неделю',
  'stats.averageDuration': 'Средняя длительность',
  'stats.completion': 'Завершённость',
  'stats.byWeeks': 'Тренировок по неделям',
  'stats.byPrograms': 'По программам',
  'stats.streak': 'Текущая серия',
  'stats.streakRecord': 'рекорд — {value}',

  'settings.data': 'Данные',
  'settings.export': 'Экспорт в файл',
  'settings.import': 'Импорт из файла',
  'settings.backups': 'Автобэкапы',
  'settings.preferences': 'Предпочтения',
  'settings.units': 'Единицы веса',
  'settings.firstDay': 'Первый день недели',
  'settings.language': 'Язык',
  'settings.theme': 'Тема',
  'settings.dangerZone': 'Опасная зона',
  'settings.wipe': 'Удалить все данные',
  'settings.system': 'Системный',
  'settings.light': 'Светлая',
  'settings.dark': 'Тёмная',
  'settings.monday': 'Понедельник',
  'settings.sunday': 'Воскресенье',
  'settings.offline': 'работает без интернета',

  'common.cancel': 'Отмена',
  'common.save': 'Сохранить',
  'common.done': 'Готово',
  'common.delete': 'Удалить',
  'common.empty': '—',
} as const

export const en: Record<keyof typeof ru, string> = {
  'tab.calendar': 'Calendar',
  'tab.workouts': 'Workouts',
  'tab.library': 'Library',
  'tab.stats': 'Stats',
  'tab.settings': 'Settings',

  'calendar.month': 'Month',
  'calendar.year': 'Year',
  'calendar.absence': 'Time off',
  'calendar.today': 'Today',
  'calendar.continueWorkout': 'Continue workout',

  'workout.inProgress': 'In progress',
  'workout.startedAt': 'started at {time}',
  'workout.addExercise': 'Add exercise',
  'workout.addSet': '＋ set',
  'workout.notFinished': 'not finished',
  'workout.history': 'Exercise history',
  'workout.dateTaken': 'There is already a workout on this date',
  'workout.openExisting': 'Open existing',

  'set.weight': 'Weight, kg',
  'set.weightLb': 'Weight, lb',
  'set.reps': 'Reps',
  'set.previous': 'Last time: {value}',
  'set.submit': 'Add set',
  'set.number': 'Set {number}',

  'library.exercises': 'Exercises',
  'library.programs': 'Programs',
  'library.search': 'Search exercises',
  'library.sortAlphabet': 'A–Z',
  'library.sortFrequency': 'By frequency',
  'library.sortDate': 'By date',
  'library.lastTime': 'last time {date}',

  'program.new': 'New program',
  'program.name': 'Name',
  'program.namePlaceholder': 'For example, Chest + triceps',
  'program.nameHint': 'Any name you like: “Chest + triceps”, “Day A”, “Heavy”',
  'program.color': 'Program colour',
  'program.composition': 'Exercises',
  'program.empty': 'Nothing yet',
  'program.emptyHint': 'Add exercises from the library or create a new one',
  'program.create': 'Create program',
  'program.createDisabledHint': 'The button turns on once there is a name',
  'program.duplicate': 'Duplicate',
  'program.archive': 'Archive',

  'exercise.new': 'New exercise',
  'exercise.namePlaceholder': 'For example, Close-grip bench press',
  'exercise.nameFree': 'No such exercise yet',
  'exercise.muscleGroup': 'Muscle group',
  'exercise.note': 'Note',
  'exercise.noteOptional': 'optional',
  'exercise.notePlaceholder': 'Technique, feel, machine settings',
  'exercise.create': 'Create exercise',
  'exercise.weightHint': 'Weight is optional — for pull-ups, dips and planks',

  'stats.workouts': 'Workouts',
  'stats.perWeek': 'Per week',
  'stats.averageDuration': 'Average duration',
  'stats.completion': 'Completion',
  'stats.byWeeks': 'Workouts by week',
  'stats.byPrograms': 'By program',
  'stats.streak': 'Current streak',
  'stats.streakRecord': 'record — {value}',

  'settings.data': 'Data',
  'settings.export': 'Export to file',
  'settings.import': 'Import from file',
  'settings.backups': 'Auto backups',
  'settings.preferences': 'Preferences',
  'settings.units': 'Weight units',
  'settings.firstDay': 'First day of week',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.dangerZone': 'Danger zone',
  'settings.wipe': 'Delete all data',
  'settings.system': 'System',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.monday': 'Monday',
  'settings.sunday': 'Sunday',
  'settings.offline': 'works offline',

  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.done': 'Done',
  'common.delete': 'Delete',
  'common.empty': '—',
}

export type TranslationKey = keyof typeof ru

export const dictionaries = { ru, en } as const

/** Формы существительных для склонения числительных. */
export const plurals: Record<'workouts' | 'weeks' | 'exercises' | 'days', Record<'ru' | 'en', PluralForms>> = {
  workouts: {
    ru: { one: 'тренировка', few: 'тренировки', many: 'тренировок', other: 'тренировки' },
    en: { one: 'workout', other: 'workouts' },
  },
  weeks: {
    ru: { one: 'неделя', few: 'недели', many: 'недель', other: 'недели' },
    en: { one: 'week', other: 'weeks' },
  },
  exercises: {
    ru: { one: 'упражнение', few: 'упражнения', many: 'упражнений', other: 'упражнения' },
    en: { one: 'exercise', other: 'exercises' },
  },
  days: {
    ru: { one: 'день', few: 'дня', many: 'дней', other: 'дня' },
    en: { one: 'day', other: 'days' },
  },
}
