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
