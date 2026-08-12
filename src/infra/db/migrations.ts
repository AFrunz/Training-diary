import type { SqlDriver } from './driver'

/** Текущая версия схемы. Растёт с каждой миграцией. */
export const SCHEMA_VERSION = 1

/**
 * Приводит базу к актуальной версии. Вызывается при каждом запуске приложения:
 * на новой базе создаёт всё с нуля, на существующей применяет недостающие шаги.
 * Повторный вызов ничего не меняет.
 */
export async function applyMigrations(_driver: SqlDriver): Promise<{ from: number; to: number }> {
  throw new Error('applyMigrations не реализована')
}

/** Версия схемы, записанная в базе. 0 — база пустая. */
export async function readSchemaVersion(_driver: SqlDriver): Promise<number> {
  throw new Error('readSchemaVersion не реализована')
}
