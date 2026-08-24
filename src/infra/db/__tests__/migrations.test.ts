import { SCHEMA_VERSION, applyMigrations, readSchemaVersion } from '../migrations'
import { createNodeSqlDriver } from '../testing/nodeSqlite'
import type { SqlDriver } from '../driver'

const tables = async (driver: SqlDriver) =>
  (await driver.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", []))
    .map((row) => row[0] as string)
    .filter((name) => !name.startsWith('sqlite_'))

describe('applyMigrations', () => {
  it('на пустой базе создаёт все таблицы из §6 ТЗ', async () => {
    const driver = createNodeSqlDriver()
    await applyMigrations(driver)

    expect(await tables(driver)).toEqual([
      'absences',
      'exercises',
      'program_items',
      'programs',
      'schema_meta',
      'settings',
      'workout_items',
      'workout_sets',
      'workouts',
    ])
  })

  it('записывает версию схемы', async () => {
    const driver = createNodeSqlDriver()
    await applyMigrations(driver)
    await expect(readSchemaVersion(driver)).resolves.toBe(SCHEMA_VERSION)
  })

  it('пустая база имеет версию 0', async () => {
    const driver = createNodeSqlDriver()
    await expect(readSchemaVersion(driver)).resolves.toBe(0)
  })

  it('сообщает, с какой версии на какую перешли', async () => {
    const driver = createNodeSqlDriver()
    await expect(applyMigrations(driver)).resolves.toEqual({ from: 0, to: SCHEMA_VERSION })
  })

  it('повторный запуск ничего не меняет и не падает', async () => {
    const driver = createNodeSqlDriver()
    await applyMigrations(driver)
    await expect(applyMigrations(driver)).resolves.toEqual({
      from: SCHEMA_VERSION,
      to: SCHEMA_VERSION,
    })
  })

  it('повторный запуск не стирает данные', async () => {
    const driver = createNodeSqlDriver()
    await applyMigrations(driver)
    await driver.run(
      'INSERT INTO exercises (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ['e-1', 'Жим лёжа', 1, 1],
    )

    await applyMigrations(driver)

    await expect(driver.all('SELECT name FROM exercises', [])).resolves.toEqual([['Жим лёжа']])
  })

  it('включает внешние ключи: без этого каскады молча не работают', async () => {
    const driver = createNodeSqlDriver()
    await applyMigrations(driver)
    await expect(driver.all('PRAGMA foreign_keys', [])).resolves.toEqual([[1]])
  })

  it('создаёт уникальный индекс на дату тренировки (FR-1.3)', async () => {
    const driver = createNodeSqlDriver()
    await applyMigrations(driver)

    const indexes = (
      await driver.all("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='workouts'", [])
    ).map((row) => row[0])
    expect(indexes).toContain('workouts_unique_date')
  })

  it('заводит строку настроек со значениями по умолчанию', async () => {
    const driver = createNodeSqlDriver()
    await applyMigrations(driver)

    await expect(driver.all('SELECT unit, first_day_of_week, theme, language FROM settings', [])).resolves.toEqual([
      ['kg', 1, 'system', 'system'],
    ])
  })
})

/**
 * Переезд единицы из настроек в подход (FR-4.11). База версии 1 собирается
 * вручную: подходы в ней уже есть, и обновление не должно их потерять.
 */
describe('переход со схемы 1 на 2', () => {
  const seedVersionOne = async (unit: 'kg' | 'lb'): Promise<SqlDriver> => {
    const driver = createNodeSqlDriver()
    await driver.exec(
      `CREATE TABLE workout_sets (
        id TEXT PRIMARY KEY,
        workout_item_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        weight_kg REAL,
        reps INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    )
    await driver.exec(
      `CREATE TABLE settings (
        id INTEGER PRIMARY KEY,
        unit TEXT NOT NULL,
        first_day_of_week INTEGER NOT NULL,
        theme TEXT NOT NULL,
        language TEXT NOT NULL
      )`,
    )
    await driver.run('INSERT INTO settings (id, unit, first_day_of_week, theme, language) VALUES (1, ?, 1, ?, ?)', [
      unit,
      'system',
      'system',
    ])
    await driver.run(
      'INSERT INTO workout_sets (id, workout_item_id, order_index, weight_kg, reps, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['ws-1', 'wi-1', 0, 82.5, 6, 1],
    )
    await driver.exec(
      'CREATE TABLE schema_meta (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, applied_at INTEGER NOT NULL)',
    )
    await driver.run('INSERT INTO schema_meta (id, version, applied_at) VALUES (1, 1, 1)', [])
    return driver
  }

  it('дописывает единицу к записанным подходам, не трогая вес', async () => {
    const driver = await seedVersionOne('kg')

    await expect(applyMigrations(driver)).resolves.toEqual({ from: 1, to: SCHEMA_VERSION })
    await expect(driver.all('SELECT weight_kg, angle_deg, unit, reps FROM workout_sets', [])).resolves.toEqual([
      [82.5, null, 'kg', 6],
    ])
  })

  it('единица берётся из настроек: кто считал в фунтах, того история не переедет в килограммы', async () => {
    const driver = await seedVersionOne('lb')

    await applyMigrations(driver)
    await expect(driver.all('SELECT unit FROM workout_sets', [])).resolves.toEqual([['lb']])
  })
})
