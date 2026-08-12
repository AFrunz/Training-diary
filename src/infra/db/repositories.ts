import type {
  Absence,
  AbsenceType,
  Exercise,
  Program,
  ProgramItem,
  Settings,
  Workout,
  WorkoutItem,
  WorkoutSet,
} from '../../domain/model/entities'
import type { FirstDayOfWeek, Id, Instant, LocalDate, WeightUnit } from '../../domain/model/types'
import { id as makeId, instant, localDate } from '../../domain/model/types'
import type { Ports, WorkoutAggregate } from '../../app/ports'
import type { SqlDriver } from './driver'

/**
 * Реализация портов поверх SQLite. Единственное место в приложении, где живёт SQL.
 */
export type DataPorts = Pick<
  Ports,
  'workouts' | 'programs' | 'exercises' | 'absences' | 'settings' | 'uow'
>

type Row = readonly unknown[]

const num = (value: unknown): number => Number(value)
const nullableNum = (value: unknown): number | null => (value === null ? null : Number(value))
const str = (value: unknown): string => String(value)
const nullableStr = (value: unknown): string | null => (value === null ? null : String(value))

const toExercise = (row: Row): Exercise => ({
  id: makeId(str(row[0])),
  name: str(row[1]),
  muscleGroup: nullableStr(row[2]),
  note: nullableStr(row[3]),
  archivedAt: row[4] === null ? null : instant(num(row[4])),
  createdAt: instant(num(row[5])),
  updatedAt: instant(num(row[6])),
})

const EXERCISE_COLUMNS = 'id, name, muscle_group, note, archived_at, created_at, updated_at'

const toProgram = (row: Row): Program => ({
  id: makeId(str(row[0])),
  name: str(row[1]),
  color: str(row[2]),
  archivedAt: row[3] === null ? null : instant(num(row[3])),
  createdAt: instant(num(row[4])),
  updatedAt: instant(num(row[5])),
})

const PROGRAM_COLUMNS = 'id, name, color, archived_at, created_at, updated_at'

const toWorkout = (row: Row): Workout => ({
  id: makeId(str(row[0])),
  date: localDate(str(row[1])),
  programId: makeId(str(row[2])),
  programName: str(row[3]),
  programColor: str(row[4]),
  startedAt: instant(num(row[5])),
  finishedAt: row[6] === null ? null : instant(num(row[6])),
  manualStartedAt: row[7] === null ? null : instant(num(row[7])),
  manualFinishedAt: row[8] === null ? null : instant(num(row[8])),
  note: nullableStr(row[9]),
  createdAt: instant(num(row[10])),
  updatedAt: instant(num(row[11])),
})

const WORKOUT_COLUMNS =
  'id, date, program_id, program_name, program_color, started_at, finished_at, manual_started_at, manual_finished_at, note, created_at, updated_at'

const toWorkoutItem = (row: Row): WorkoutItem => ({
  id: makeId(str(row[0])),
  workoutId: makeId(str(row[1])),
  exerciseId: makeId(str(row[2])),
  exerciseName: str(row[3]),
  order: num(row[4]),
  // SQLite не знает булевых значений: приводим единицу обратно к true
  isAdHoc: num(row[5]) === 1,
  completedAt: row[6] === null ? null : instant(num(row[6])),
})

const WORKOUT_ITEM_COLUMNS =
  'id, workout_id, exercise_id, exercise_name, order_index, is_ad_hoc, completed_at'

const toWorkoutSet = (row: Row): WorkoutSet => ({
  id: makeId(str(row[0])),
  workoutItemId: makeId(str(row[1])),
  order: num(row[2]),
  weightKg: nullableNum(row[3]),
  reps: num(row[4]),
  createdAt: instant(num(row[5])),
})

const WORKOUT_SET_COLUMNS = 'id, workout_item_id, order_index, weight_kg, reps, created_at'

const toAbsence = (row: Row): Absence => ({
  id: makeId(str(row[0])),
  startDate: localDate(str(row[1])),
  endDate: localDate(str(row[2])),
  type: str(row[3]) as AbsenceType,
  note: nullableStr(row[4]),
  createdAt: instant(num(row[5])),
  updatedAt: instant(num(row[6])),
})

const ABSENCE_COLUMNS = 'id, start_date, end_date, type, note, created_at, updated_at'

export function createSqliteRepositories(driver: SqlDriver): DataPorts {
  const insertWorkoutItem = (item: WorkoutItem) =>
    driver.run(
      `INSERT INTO workout_items (${WORKOUT_ITEM_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.workoutId,
        item.exerciseId,
        item.exerciseName,
        item.order,
        item.isAdHoc ? 1 : 0,
        item.completedAt ?? null,
      ],
    )

  return {
    uow: {
      async tx<T>(fn: () => Promise<T>): Promise<T> {
        await driver.exec('BEGIN')
        try {
          const result = await fn()
          await driver.exec('COMMIT')
          return result
        } catch (error) {
          await driver.exec('ROLLBACK')
          throw error
        }
      },
    },

    workouts: {
      async byDate(date) {
        const rows = await driver.all(`SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE date = ?`, [date])
        return rows[0] ? toWorkout(rows[0]) : null
      },

      async byId(id): Promise<WorkoutAggregate | null> {
        const workoutRows = await driver.all(`SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE id = ?`, [id])
        if (!workoutRows[0]) return null

        const itemRows = await driver.all(
          `SELECT ${WORKOUT_ITEM_COLUMNS} FROM workout_items WHERE workout_id = ? ORDER BY order_index`,
          [id],
        )
        const items = itemRows.map(toWorkoutItem)

        const setRows = await driver.all(
          `SELECT ${WORKOUT_SET_COLUMNS} FROM workout_sets
           WHERE workout_item_id IN (SELECT id FROM workout_items WHERE workout_id = ?)
           ORDER BY order_index`,
          [id],
        )
        const sets = setRows.map(toWorkoutSet)

        return {
          workout: toWorkout(workoutRows[0]),
          items: items.map((item) => ({
            ...item,
            sets: sets.filter((set) => set.workoutItemId === item.id),
          })),
        }
      },

      async listRange(range) {
        const rows = await driver.all(
          `SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE date >= ? AND date <= ? ORDER BY date`,
          [range.from, range.to],
        )
        return rows.map(toWorkout)
      },

      async insert(workout, items) {
        await driver.run(
          `INSERT INTO workouts (${WORKOUT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            workout.id,
            workout.date,
            workout.programId,
            workout.programName,
            workout.programColor,
            workout.startedAt,
            workout.finishedAt ?? null,
            workout.manualStartedAt ?? null,
            workout.manualFinishedAt ?? null,
            workout.note ?? null,
            workout.createdAt,
            workout.updatedAt,
          ],
        )
        for (const item of items) await insertWorkoutItem(item)
      },

      async update(workout) {
        await driver.run(
          `UPDATE workouts SET date = ?, program_id = ?, program_name = ?, program_color = ?,
             started_at = ?, finished_at = ?, manual_started_at = ?, manual_finished_at = ?,
             note = ?, updated_at = ? WHERE id = ?`,
          [
            workout.date,
            workout.programId,
            workout.programName,
            workout.programColor,
            workout.startedAt,
            workout.finishedAt ?? null,
            workout.manualStartedAt ?? null,
            workout.manualFinishedAt ?? null,
            workout.note ?? null,
            workout.updatedAt,
            workout.id,
          ],
        )
      },

      async remove(id) {
        // упражнения и подходы уходят каскадом, заданным в схеме
        await driver.run('DELETE FROM workouts WHERE id = ?', [id])
      },

      async addItem(item) {
        await insertWorkoutItem(item)
      },

      async addSet(set) {
        await driver.run(
          `INSERT INTO workout_sets (${WORKOUT_SET_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`,
          [set.id, set.workoutItemId, set.order, set.weightKg ?? null, set.reps, set.createdAt],
        )
      },

      async setItemCompleted(itemId, at) {
        await driver.run('UPDATE workout_items SET completed_at = ? WHERE id = ?', [at, itemId])
      },

      async lastSetOf(exerciseId, options) {
        const rows = await driver.all(
          `SELECT ${WORKOUT_SET_COLUMNS.split(', ')
            .map((column) => `s.${column}`)
            .join(', ')}
           FROM workout_sets s
           JOIN workout_items i ON i.id = s.workout_item_id
           JOIN workouts w ON w.id = i.workout_id
           WHERE i.exercise_id = ? AND (? IS NULL OR i.workout_id <> ?)
           ORDER BY w.date DESC, s.order_index DESC
           LIMIT 1`,
          [exerciseId, options?.exceptWorkoutId ?? null, options?.exceptWorkoutId ?? null],
        )
        return rows[0] ? toWorkoutSet(rows[0]) : null
      },
    },

    programs: {
      async byId(id) {
        const rows = await driver.all(`SELECT ${PROGRAM_COLUMNS} FROM programs WHERE id = ?`, [id])
        return rows[0] ? toProgram(rows[0]) : null
      },

      async byIdWithItems(id) {
        const programRows = await driver.all(`SELECT ${PROGRAM_COLUMNS} FROM programs WHERE id = ?`, [id])
        if (!programRows[0]) return null

        const itemRows = await driver.all(
          `SELECT pi.id, pi.program_id, pi.exercise_id, pi.order_index, pi.target_sets, pi.target_reps, e.name
           FROM program_items pi
           JOIN exercises e ON e.id = pi.exercise_id
           WHERE pi.program_id = ? ORDER BY pi.order_index`,
          [id],
        )

        return {
          program: toProgram(programRows[0]),
          items: itemRows.map((row) => ({
            id: makeId(str(row[0])),
            programId: makeId(str(row[1])),
            exerciseId: makeId(str(row[2])),
            order: num(row[3]),
            targetSets: nullableNum(row[4]),
            targetReps: nullableNum(row[5]),
            exerciseName: str(row[6]),
          })),
        }
      },

      async list(options) {
        const rows = await driver.all(
          `SELECT ${PROGRAM_COLUMNS} FROM programs${options?.includeArchived ? '' : ' WHERE archived_at IS NULL'} ORDER BY created_at`,
          [],
        )
        return rows.map(toProgram)
      },

      async insert(program, items) {
        await driver.run(
          `INSERT INTO programs (${PROGRAM_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            program.id,
            program.name,
            program.color,
            program.archivedAt ?? null,
            program.createdAt,
            program.updatedAt,
          ],
        )
        for (const item of items) {
          await driver.run(
            'INSERT INTO program_items (id, program_id, exercise_id, order_index, target_sets, target_reps) VALUES (?, ?, ?, ?, ?, ?)',
            [item.id, item.programId, item.exerciseId, item.order, item.targetSets ?? null, item.targetReps ?? null],
          )
        }
      },

      async update(program) {
        await driver.run(
          'UPDATE programs SET name = ?, color = ?, archived_at = ?, updated_at = ? WHERE id = ?',
          [program.name, program.color, program.archivedAt ?? null, program.updatedAt, program.id],
        )
      },

      async replaceItems(programId, items: readonly ProgramItem[]) {
        await driver.run('DELETE FROM program_items WHERE program_id = ?', [programId])
        for (const item of items) {
          await driver.run(
            'INSERT INTO program_items (id, program_id, exercise_id, order_index, target_sets, target_reps) VALUES (?, ?, ?, ?, ?, ?)',
            [item.id, item.programId, item.exerciseId, item.order, item.targetSets ?? null, item.targetReps ?? null],
          )
        }
      },

      async remove(id) {
        await driver.run('DELETE FROM programs WHERE id = ?', [id])
      },
    },

    exercises: {
      async byId(id) {
        const rows = await driver.all(`SELECT ${EXERCISE_COLUMNS} FROM exercises WHERE id = ?`, [id])
        return rows[0] ? toExercise(rows[0]) : null
      },

      async list(options) {
        const rows = await driver.all(
          `SELECT ${EXERCISE_COLUMNS} FROM exercises${options?.includeArchived ? '' : ' WHERE archived_at IS NULL'} ORDER BY name`,
          [],
        )
        return rows.map(toExercise)
      },

      async insert(exercise) {
        await driver.run(
          `INSERT INTO exercises (${EXERCISE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            exercise.id,
            exercise.name,
            exercise.muscleGroup ?? null,
            exercise.note ?? null,
            exercise.archivedAt ?? null,
            exercise.createdAt,
            exercise.updatedAt,
          ],
        )
      },

      async update(exercise) {
        await driver.run(
          'UPDATE exercises SET name = ?, muscle_group = ?, note = ?, archived_at = ?, updated_at = ? WHERE id = ?',
          [
            exercise.name,
            exercise.muscleGroup ?? null,
            exercise.note ?? null,
            exercise.archivedAt ?? null,
            exercise.updatedAt,
            exercise.id,
          ],
        )
      },

      async remove(id) {
        await driver.run('DELETE FROM exercises WHERE id = ?', [id])
      },

      async isUsed(id) {
        const rows = await driver.all(
          'SELECT 1 FROM workout_items WHERE exercise_id = ? LIMIT 1',
          [id],
        )
        return rows.length > 0
      },
    },

    absences: {
      async listRange(range) {
        const rows = await driver.all(
          `SELECT ${ABSENCE_COLUMNS} FROM absences WHERE start_date <= ? AND end_date >= ? ORDER BY start_date`,
          [range.to, range.from],
        )
        return rows.map(toAbsence)
      },

      async insert(absence) {
        await driver.run(
          `INSERT INTO absences (${ABSENCE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            absence.id,
            absence.startDate,
            absence.endDate,
            absence.type,
            absence.note ?? null,
            absence.createdAt,
            absence.updatedAt,
          ],
        )
      },

      async remove(id) {
        await driver.run('DELETE FROM absences WHERE id = ?', [id])
      },
    },

    settings: {
      async get(): Promise<Settings> {
        const rows = await driver.all(
          'SELECT unit, first_day_of_week, theme, language FROM settings WHERE id = 1',
          [],
        )
        const row = rows[0]!
        return {
          unit: str(row[0]) as WeightUnit,
          firstDayOfWeek: num(row[1]) as FirstDayOfWeek,
          theme: str(row[2]) as Settings['theme'],
          language: str(row[3]) as Settings['language'],
        }
      },

      async set(settings) {
        await driver.run(
          'UPDATE settings SET unit = ?, first_day_of_week = ?, theme = ?, language = ? WHERE id = 1',
          [settings.unit, settings.firstDayOfWeek, settings.theme, settings.language],
        )
      },
    },
  }
}

export type { Id, Instant, LocalDate }
