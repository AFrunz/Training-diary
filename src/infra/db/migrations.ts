import type { SqlDriver } from './driver'

/** Текущая версия схемы. Растёт с каждой миграцией. */
export const SCHEMA_VERSION = 1

/**
 * Шаги миграции. Каждый шаг применяется целиком и ровно один раз;
 * добавлять новые нужно в конец, не меняя уже вышедшие.
 */
const MIGRATIONS: readonly { readonly version: number; readonly statements: readonly string[] }[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE exercises (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        muscle_group TEXT,
        note TEXT,
        archived_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE programs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        archived_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE program_items (
        id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
        order_index INTEGER NOT NULL,
        target_sets INTEGER,
        target_reps INTEGER
      )`,
      `CREATE UNIQUE INDEX program_items_unique_exercise ON program_items (program_id, exercise_id)`,
      `CREATE INDEX program_items_by_program ON program_items (program_id, order_index)`,
      `CREATE TABLE workouts (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        program_id TEXT NOT NULL,
        program_name TEXT NOT NULL,
        program_color TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        manual_started_at INTEGER,
        manual_finished_at INTEGER,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      // одна тренировка на дату (FR-1.3) — правило уровня базы, а не только кода
      `CREATE UNIQUE INDEX workouts_unique_date ON workouts (date)`,
      `CREATE TABLE workout_items (
        id TEXT PRIMARY KEY,
        workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL,
        exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        is_ad_hoc INTEGER NOT NULL,
        completed_at INTEGER
      )`,
      `CREATE UNIQUE INDEX workout_items_unique_exercise ON workout_items (workout_id, exercise_id)`,
      `CREATE INDEX workout_items_by_workout ON workout_items (workout_id, order_index)`,
      `CREATE INDEX workout_items_by_exercise ON workout_items (exercise_id)`,
      `CREATE TABLE workout_sets (
        id TEXT PRIMARY KEY,
        workout_item_id TEXT NOT NULL REFERENCES workout_items(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL,
        weight_kg REAL,
        reps INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX workout_sets_by_item ON workout_sets (workout_item_id, order_index)`,
      `CREATE TABLE absences (
        id TEXT PRIMARY KEY,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        type TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX absences_by_range ON absences (start_date, end_date)`,
      `CREATE TABLE settings (
        id INTEGER PRIMARY KEY,
        unit TEXT NOT NULL,
        first_day_of_week INTEGER NOT NULL,
        theme TEXT NOT NULL,
        language TEXT NOT NULL
      )`,
      `INSERT INTO settings (id, unit, first_day_of_week, theme, language)
       VALUES (1, 'kg', 1, 'system', 'system')`,
    ],
  },
]

const hasSchemaMeta = async (driver: SqlDriver): Promise<boolean> => {
  const rows = await driver.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_meta'",
    [],
  )
  return rows.length > 0
}

export async function readSchemaVersion(driver: SqlDriver): Promise<number> {
  if (!(await hasSchemaMeta(driver))) return 0
  const rows = await driver.all('SELECT version FROM schema_meta WHERE id = 1', [])
  return (rows[0]?.[0] as number | undefined) ?? 0
}

export async function applyMigrations(driver: SqlDriver): Promise<{ from: number; to: number }> {
  // без этого SQLite молча игнорирует внешние ключи и каскадное удаление
  await driver.exec('PRAGMA foreign_keys = ON')
  await driver.exec(
    'CREATE TABLE IF NOT EXISTS schema_meta (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, applied_at INTEGER NOT NULL)',
  )

  const from = await readSchemaVersion(driver)
  const pending = MIGRATIONS.filter((migration) => migration.version > from)
  if (pending.length === 0) return { from, to: from }

  await driver.exec('BEGIN')
  try {
    for (const migration of pending) {
      for (const statement of migration.statements) {
        await driver.exec(statement)
      }
    }
    await driver.run(
      'INSERT INTO schema_meta (id, version, applied_at) VALUES (1, ?, ?)\n' +
        'ON CONFLICT(id) DO UPDATE SET version = excluded.version, applied_at = excluded.applied_at',
      [SCHEMA_VERSION, Date.now()],
    )
    await driver.exec('COMMIT')
  } catch (error) {
    await driver.exec('ROLLBACK')
    throw error
  }

  return { from, to: SCHEMA_VERSION }
}
