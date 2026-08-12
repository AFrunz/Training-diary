import * as SQLite from 'expo-sqlite'
import type { SqlDriver } from './driver'

/**
 * Драйвер приложения поверх expo-sqlite. Интерфейс тот же, что у тестового
 * драйвера на node:sqlite, поэтому репозитории и их тесты общие.
 *
 * База лежит в приватной директории приложения (§7.1).
 */
export const DATABASE_NAME = 'training-diary.db'

export const createExpoSqlDriver = async (name = DATABASE_NAME): Promise<SqlDriver> => {
  const db = await SQLite.openDatabaseAsync(name)
  // без этого SQLite молча игнорирует внешние ключи и каскадное удаление
  await db.execAsync('PRAGMA foreign_keys = ON')

  return {
    async exec(sql) {
      await db.execAsync(sql)
    },
    async all(sql, params) {
      const rows = await db.getAllAsync<Record<string, unknown>>(sql, params as SQLite.SQLiteBindValue[])
      return rows.map((row) => Object.values(row))
    },
    async run(sql, params) {
      await db.runAsync(sql, params as SQLite.SQLiteBindValue[])
    },
    async close() {
      await db.closeAsync()
    },
  }
}
