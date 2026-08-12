import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import type { SqlDriver } from '../driver'

/**
 * Драйвер поверх встроенного в Node `node:sqlite` — только для тестов.
 * Требует запуска с флагом `--experimental-sqlite` (см. скрипт `test` в package.json).
 *
 * В приложении вместо него подключается expo-sqlite: тот же интерфейс SqlDriver.
 */
export const createNodeSqlDriver = (file = ':memory:'): SqlDriver => {
  const db = new DatabaseSync(file)
  // Без этого SQLite молча игнорирует внешние ключи и каскадное удаление
  db.exec('PRAGMA foreign_keys = ON')

  return {
    async exec(sql) {
      db.exec(sql)
    },
    async all(sql, params) {
      const statement = db.prepare(sql)
      const rows = statement.all(...(params as never[])) as Record<string, unknown>[]
      return rows.map((row) => Object.values(row))
    },
    async run(sql, params) {
      db.prepare(sql).run(...(params as never[]))
    },
    async close() {
      db.close()
    },
  }
}

/** Drizzle поверх произвольного драйвера: запросы пишутся один раз и работают в обоих окружениях. */
export const createDrizzle = (driver: SqlDriver) =>
  drizzle(async (sql, params, method) => {
    if (method === 'run') {
      await driver.run(sql, params)
      return { rows: [] }
    }
    const rows = await driver.all(sql, params)
    return { rows: method === 'get' ? (rows[0] ?? []) : rows }
  })

export type TestDb = ReturnType<typeof createDrizzle>
