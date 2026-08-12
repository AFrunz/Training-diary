import { ImportError } from '../../domain/transfer/types'
import type { ImportMode, MergeSummary } from '../../domain/transfer/types'
import { toLocalDate } from '../../domain/rules/dates'
import type { Ports } from '../ports'
import { exportAll, importAll } from './data'

/**
 * Файловая часть экспорта и импорта (FR-7.1–FR-7.3). Сценарии знают только порт
 * `files`, поэтому тестируются без файловой системы.
 */

/** Сколько автобэкапов держим (FR-7.3). */
export const BACKUPS_KEPT = 5

const exportFileName = (p: Ports): string => `training-diary-${toLocalDate(p.clock.now(), p.timeZone)}.json`

/** Выгружает базу в файл и открывает системное «Поделиться». */
export const exportToFile = (p: Ports) => async (): Promise<string> => {
  const bundle = await exportAll(p)()
  const path = await p.files.saveExport(exportFileName(p), bundle)
  await p.files.share(path)
  return path
}

export interface ImportFromFileResult {
  readonly cancelled: boolean
  readonly summary?: MergeSummary
}

/**
 * Просит выбрать файл и вливает его. Перед импортом снимается автобэкап:
 * если пользователь ошибся режимом, откатиться будет чем.
 */
export const importFromFile =
  (p: Ports) =>
  async (mode: ImportMode): Promise<ImportFromFileResult> => {
    const raw = await p.files.pickJson()
    if (raw === null) return { cancelled: true }

    await runBackup(p)()
    const summary = await importAll(p)({ raw, mode })
    return { cancelled: false, summary }
  }

/** Снимок базы в автобэкап с ротацией: держим только последние. */
export const runBackup = (p: Ports) => async (): Promise<string> => {
  const bundle = await exportAll(p)()
  const fileName = `backup-${p.clock.now()}.json`
  await p.files.saveBackup(fileName, bundle)

  const backups = await p.files.listBackups()
  for (const stale of backups.slice(BACKUPS_KEPT)) {
    await p.files.removeBackup(stale)
  }
  return fileName
}

/** Восстановление из автобэкапа: полная замена текущего состояния. */
export const restoreBackup = (p: Ports) => async (fileName: string): Promise<MergeSummary> => {
  const raw = await p.files.readBackup(fileName)
  if (raw === null) throw new ImportError('not-an-object', fileName)
  return importAll(p)({ raw, mode: 'replace' })
}

/** Полная очистка данных (FR-7.4). Настройки устройства остаются как были. */
export const wipeAllData = (p: Ports) => async (): Promise<void> => {
  const bundle = await exportAll(p)()

  await p.uow.tx(async () => {
    for (const workout of bundle.workouts) await p.workouts.remove(workout.id)
    for (const program of bundle.programs) await p.programs.remove(program.id)
    for (const absence of bundle.absences) await p.absences.remove(absence.id)
    for (const exercise of bundle.exercises) await p.exercises.remove(exercise.id)
  })
}
