import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Схема базы по §6 ТЗ. Идентификаторы — UUID строками, моменты времени — миллисекунды эпохи,
 * даты — строки `YYYY-MM-DD` (сравнение строк совпадает с хронологическим порядком).
 *
 * Вес всегда в килограммах (FR-7.5).
 */

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group'),
  note: text('note'),
  archivedAt: integer('archived_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const programs = sqliteTable('programs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  archivedAt: integer('archived_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const programItems = sqliteTable(
  'program_items',
  {
    id: text('id').primaryKey(),
    programId: text('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    order: integer('order_index').notNull(),
    targetSets: integer('target_sets'),
    targetReps: integer('target_reps'),
  },
  (t) => ({
    /** Одно упражнение не может входить в программу дважды (FR-3.3). */
    uniqueExercise: uniqueIndex('program_items_unique_exercise').on(t.programId, t.exerciseId),
    byProgram: index('program_items_by_program').on(t.programId, t.order),
  }),
)

export const workouts = sqliteTable(
  'workouts',
  {
    id: text('id').primaryKey(),
    /** Одна тренировка на дату (FR-1.3). */
    date: text('date').notNull(),
    programId: text('program_id').notNull(),
    /** Снапшоты названия и цвета программы (FR-3.5). */
    programName: text('program_name').notNull(),
    programColor: text('program_color').notNull(),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    manualStartedAt: integer('manual_started_at'),
    manualFinishedAt: integer('manual_finished_at'),
    note: text('note'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniqueDate: uniqueIndex('workouts_unique_date').on(t.date),
  }),
)

export const workoutItems = sqliteTable(
  'workout_items',
  {
    id: text('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id').notNull(),
    /** Снапшот названия: переименование упражнения не меняет историю. */
    exerciseName: text('exercise_name').notNull(),
    order: integer('order_index').notNull(),
    isAdHoc: integer('is_ad_hoc', { mode: 'boolean' }).notNull(),
    completedAt: integer('completed_at'),
  },
  (t) => ({
    uniqueExercise: uniqueIndex('workout_items_unique_exercise').on(t.workoutId, t.exerciseId),
    byWorkout: index('workout_items_by_workout').on(t.workoutId, t.order),
    byExercise: index('workout_items_by_exercise').on(t.exerciseId),
  }),
)

export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: text('id').primaryKey(),
    workoutItemId: text('workout_item_id')
      .notNull()
      .references(() => workoutItems.id, { onDelete: 'cascade' }),
    order: integer('order_index').notNull(),
    weightKg: real('weight_kg'),
    /** Угол наклона: заполнен вместо веса при `unit = 'deg'` (FR-4.11). */
    angleDeg: real('angle_deg'),
    /** Единица ввода: 'kg', 'lb' или 'deg'. Вес всё равно лежит в килограммах. */
    unit: text('unit').notNull(),
    reps: integer('reps').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    byItem: index('workout_sets_by_item').on(t.workoutItemId, t.order),
  }),
)

export const absences = sqliteTable(
  'absences',
  {
    id: text('id').primaryKey(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    type: text('type').notNull(),
    note: text('note'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    byRange: index('absences_by_range').on(t.startDate, t.endDate),
  }),
)

/** Настройки хранятся единственной строкой с фиксированным ключом. */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  unit: text('unit').notNull(),
  firstDayOfWeek: integer('first_day_of_week').notNull(),
  theme: text('theme').notNull(),
  language: text('language').notNull(),
})

/** Версия применённой схемы: по ней решается, нужна ли миграция. */
export const schemaMeta = sqliteTable('schema_meta', {
  id: integer('id').primaryKey(),
  version: integer('version').notNull(),
  appliedAt: integer('applied_at').notNull(),
})
