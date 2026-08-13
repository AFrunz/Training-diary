import type { Instant } from '../../../domain/model/types'
import { instant } from '../../../domain/model/types'

/**
 * Разбор имён автобэкапов (FR-7.3). Сценарий `runBackup` называет копии
 * `backup-<миллисекунды>.json`, другого места, где хранится время снятия, нет.
 */

export interface BackupEntry {
  readonly fileName: string
  /** Момент снятия из имени файла; null — имя не нашего формата. */
  readonly takenAt: Instant | null
}

const BACKUP_NAME = /^backup-(\d+)\.json$/

export const backupTakenAt = (fileName: string): Instant | null => {
  const match = BACKUP_NAME.exec(fileName)
  if (!match?.[1]) return null

  const ms = Number(match[1])
  return Number.isSafeInteger(ms) ? instant(ms) : null
}

/** Свежие первыми: порт сортирует по имени, но полагаться на это не станем. */
export const sortBackups = (fileNames: readonly string[]): readonly BackupEntry[] =>
  fileNames
    .map((fileName) => ({ fileName, takenAt: backupTakenAt(fileName) }))
    .sort((a, b) => (b.takenAt ?? 0) - (a.takenAt ?? 0))
