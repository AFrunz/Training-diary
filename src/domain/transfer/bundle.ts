import type { Absence, Exercise, Program, Workout } from '../model/entities'
import type { Id } from '../model/types'
import { ImportError, SCHEMA_VERSION } from './types'
import type { ExportBundle, ImportMode, MergeResult, MergeSummary } from './types'

/**
 * Импорт и экспорт (FR-7.1, FR-7.2). Разбор и слияние — чистые функции,
 * файловый ввод-вывод живёт в infra.
 *
 * Правила слияния:
 *  - записей нет в базе → добавляются;
 *  - совпал `id` → побеждает свежий `updatedAt`;
 *  - `updatedAt` равны → остаётся текущая запись;
 *  - дочерние записи едут вместе с родителем;
 *  - две тренировки на одну дату невозможны: проигравшая по `updatedAt` отбрасывается.
 */

const COLLECTIONS = [
  'exercises',
  'programs',
  'programItems',
  'workouts',
  'workoutItems',
  'workoutSets',
  'absences',
] as const

/** Обязательные поля записи каждой коллекции: без них файл считается испорченным. */
const REQUIRED_FIELDS: Record<(typeof COLLECTIONS)[number], readonly string[]> = {
  exercises: ['id', 'name', 'createdAt', 'updatedAt'],
  programs: ['id', 'name', 'color', 'createdAt', 'updatedAt'],
  programItems: ['id', 'programId', 'exerciseId', 'order'],
  workouts: ['id', 'date', 'programId', 'programName', 'startedAt', 'createdAt', 'updatedAt'],
  workoutItems: ['id', 'workoutId', 'exerciseId', 'exerciseName', 'order'],
  workoutSets: ['id', 'workoutItemId', 'order', 'reps'],
  absences: ['id', 'startDate', 'endDate', 'type', 'createdAt', 'updatedAt'],
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseBundle(raw: unknown): ExportBundle {
  if (!isRecord(raw)) throw new ImportError('not-an-object')

  const version = raw.schemaVersion
  if (typeof version !== 'number' || version > SCHEMA_VERSION) {
    throw new ImportError('unsupported-schema-version', `версия схемы: ${String(version)}`)
  }

  for (const collection of COLLECTIONS) {
    if (!Array.isArray(raw[collection])) {
      throw new ImportError('missing-collection', collection)
    }
  }
  if (!isRecord(raw.settings)) throw new ImportError('missing-collection', 'settings')

  for (const collection of COLLECTIONS) {
    const records = raw[collection] as unknown[]
    const seen = new Set<string>()

    for (const record of records) {
      if (!isRecord(record)) throw new ImportError('invalid-record', collection)

      for (const field of REQUIRED_FIELDS[collection]) {
        if (record[field] === undefined || record[field] === null) {
          throw new ImportError('invalid-record', `${collection}.${field}`)
        }
      }

      const recordId = String(record.id)
      if (seen.has(recordId)) throw new ImportError('duplicate-ids', `${collection}:${recordId}`)
      seen.add(recordId)
    }
  }

  const bundle = raw as unknown as ExportBundle

  // файлы прошлых версий не знают про единицу подхода: там всё было в килограммах
  return {
    ...bundle,
    workoutSets: bundle.workoutSets.map((set) => ({ ...set, unit: set.unit ?? 'kg' })),
  }
}

export function buildBundle(
  data: Omit<ExportBundle, 'schemaVersion' | 'exportedAt'>,
  exportedAt: number,
): ExportBundle {
  return { ...data, schemaVersion: SCHEMA_VERSION, exportedAt: exportedAt as ExportBundle['exportedAt'] }
}

interface Versioned {
  readonly id: Id
  readonly updatedAt: number
}

type Origin = 'current' | 'incoming'

/** Слияние одной коллекции верхнего уровня. Помечает, откуда взята каждая запись. */
const mergeCollection = <T extends Versioned>(
  current: readonly T[],
  incoming: readonly T[],
  summary: { added: number; updated: number; skipped: number },
): { records: T[]; origin: Map<string, Origin> } => {
  const byId = new Map<string, T>(current.map((record) => [record.id, record]))
  const origin = new Map<string, Origin>(current.map((record) => [record.id, 'current' as Origin]))

  for (const record of incoming) {
    const existing = byId.get(record.id)
    if (!existing) {
      byId.set(record.id, record)
      origin.set(record.id, 'incoming')
      summary.added += 1
      continue
    }
    if (record.updatedAt > existing.updatedAt) {
      byId.set(record.id, record)
      origin.set(record.id, 'incoming')
      summary.updated += 1
    } else {
      summary.skipped += 1
    }
  }

  return { records: [...byId.values()], origin }
}

const childrenOf = <T>(
  parents: readonly { id: Id }[],
  origin: Map<string, Origin>,
  current: readonly T[],
  incoming: readonly T[],
  parentIdOf: (child: T) => string,
): T[] => {
  const result: T[] = []
  for (const parent of parents) {
    const source = origin.get(parent.id) === 'incoming' ? incoming : current
    result.push(...source.filter((child) => parentIdOf(child) === parent.id))
  }
  return result
}

/** Две тренировки на одну дату не уживаются (FR-1.3): остаётся более свежая. */
const resolveDateConflicts = (
  workouts: readonly Workout[],
): { kept: Workout[]; dropped: number } => {
  const byDate = new Map<string, Workout>()
  let dropped = 0

  for (const workout of workouts) {
    const rival = byDate.get(workout.date)
    if (!rival) {
      byDate.set(workout.date, workout)
      continue
    }
    dropped += 1
    if (workout.updatedAt > rival.updatedAt) byDate.set(workout.date, workout)
  }

  return { kept: [...byDate.values()], dropped }
}

const countRecords = (bundle: ExportBundle): number =>
  bundle.exercises.length + bundle.programs.length + bundle.workouts.length + bundle.absences.length

export function mergeBundles(
  current: ExportBundle,
  incoming: ExportBundle,
  mode: ImportMode,
): MergeResult {
  if (mode === 'replace') {
    const summary: MergeSummary = {
      added: countRecords(incoming),
      updated: 0,
      skipped: 0,
      droppedByDateConflict: 0,
    }
    return { bundle: incoming, summary }
  }

  const counters = { added: 0, updated: 0, skipped: 0 }

  const exercises = mergeCollection<Exercise>(current.exercises, incoming.exercises, counters)
  const programs = mergeCollection<Program>(current.programs, incoming.programs, counters)
  const absences = mergeCollection<Absence>(current.absences, incoming.absences, counters)
  const workouts = mergeCollection<Workout>(current.workouts, incoming.workouts, counters)

  const { kept, dropped } = resolveDateConflicts(workouts.records)

  const programItems = childrenOf(
    programs.records,
    programs.origin,
    current.programItems,
    incoming.programItems,
    (item) => item.programId,
  )

  const workoutItems = childrenOf(
    kept,
    workouts.origin,
    current.workoutItems,
    incoming.workoutItems,
    (item) => item.workoutId,
  )

  // подходы берутся из того же источника, что и их упражнение
  const workoutItemOrigin = new Map<string, Origin>(
    workoutItems.map((item) => [item.id, workouts.origin.get(item.workoutId) ?? 'current']),
  )
  const workoutSets = childrenOf(
    workoutItems,
    workoutItemOrigin,
    current.workoutSets,
    incoming.workoutSets,
    (set) => set.workoutItemId,
  )

  return {
    bundle: {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: incoming.exportedAt,
      exercises: exercises.records,
      programs: programs.records,
      programItems,
      workouts: kept,
      workoutItems,
      workoutSets,
      absences: absences.records,
      // настройки — свойство устройства, файлом не перетираются
      settings: current.settings,
    },
    summary: { ...counters, droppedByDateConflict: dropped },
  }
}
