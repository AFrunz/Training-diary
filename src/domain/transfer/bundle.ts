import type { ExportBundle, ImportMode, MergeResult } from './types'

/**
 * Импорт и экспорт (FR-7.1, FR-7.2). Разбор и слияние — чистые функции,
 * файловый ввод-вывод живёт в infra, поэтому эти правила тестируются без файловой системы.
 *
 * Правила слияния:
 *  - записи, которых нет в текущей базе, добавляются;
 *  - при совпадении `id` побеждает запись со свежим `updatedAt`;
 *  - при равенстве `updatedAt` остаётся текущая — импорт не должен «дёргать» базу без причины;
 *  - дочерние записи (состав программы, упражнения тренировки, подходы) едут вместе с родителем;
 *  - две тренировки на одну дату невозможны: проигравшая по `updatedAt` отбрасывается.
 */

const notImplemented = (name: string): never => {
  throw new Error(`${name} не реализована`)
}

/** Разбирает содержимое файла. Бросает ImportError с кодом причины. */
export function parseBundle(_raw: unknown): ExportBundle {
  return notImplemented('parseBundle')
}

/** Собирает файл экспорта из текущего состояния базы. */
export function buildBundle(
  _data: Omit<ExportBundle, 'schemaVersion' | 'exportedAt'>,
  _exportedAt: number,
): ExportBundle {
  return notImplemented('buildBundle')
}

export function mergeBundles(
  _current: ExportBundle,
  _incoming: ExportBundle,
  _mode: ImportMode,
): MergeResult {
  return notImplemented('mergeBundles')
}
