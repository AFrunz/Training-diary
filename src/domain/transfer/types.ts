import type {
  Absence,
  Exercise,
  Program,
  ProgramItem,
  Settings,
  Workout,
  WorkoutItem,
  WorkoutSet,
} from '../model/entities'
import type { Instant } from '../model/types'

/** Формат файла экспорта (FR-7.1). Версия схемы обязательна: без неё импорт не отличит чужой файл. */
export const SCHEMA_VERSION = 1

export interface ExportBundle {
  readonly schemaVersion: number
  readonly exportedAt: Instant
  readonly exercises: readonly Exercise[]
  readonly programs: readonly Program[]
  readonly programItems: readonly ProgramItem[]
  readonly workouts: readonly Workout[]
  readonly workoutItems: readonly WorkoutItem[]
  readonly workoutSets: readonly WorkoutSet[]
  readonly absences: readonly Absence[]
  readonly settings: Settings
}

export type ImportMode = 'replace' | 'merge'

export interface MergeSummary {
  readonly added: number
  readonly updated: number
  /** Записи входящего файла, проигравшие по `updatedAt`. */
  readonly skipped: number
  /** Тренировки, выброшенные из-за занятой даты: одна дата — одна тренировка (FR-1.3). */
  readonly droppedByDateConflict: number
}

export interface MergeResult {
  readonly bundle: ExportBundle
  readonly summary: MergeSummary
}

export type ParseErrorCode =
  | 'not-an-object'
  | 'unsupported-schema-version'
  | 'missing-collection'
  | 'duplicate-ids'
  | 'invalid-record'

export class ImportError extends Error {
  constructor(
    readonly code: ParseErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'ImportError'
  }
}
