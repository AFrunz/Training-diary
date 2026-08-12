import type { FirstDayOfWeek, Id, Instant, LocalDate, WeightKg, WeightUnit } from './types'

/** Сущности из §6 ТЗ. Мягкое удаление через `archivedAt`, слияние при импорте — по `updatedAt`. */

export interface Exercise {
  readonly id: Id
  readonly name: string
  readonly muscleGroup?: string | null
  readonly note?: string | null
  readonly archivedAt?: Instant | null
  readonly createdAt: Instant
  readonly updatedAt: Instant
}

export interface Program {
  readonly id: Id
  readonly name: string
  readonly color: string
  readonly archivedAt?: Instant | null
  readonly createdAt: Instant
  readonly updatedAt: Instant
}

export interface ProgramItem {
  readonly id: Id
  readonly programId: Id
  readonly exerciseId: Id
  readonly order: number
  readonly targetSets?: number | null
  readonly targetReps?: number | null
}

export interface Workout {
  readonly id: Id
  /** Одна тренировка на дату (FR-1.3): уникальный ключ. */
  readonly date: LocalDate
  readonly programId: Id
  /** Снапшот на момент создания, чтобы переименование программы не «поехало» в истории (FR-3.5). */
  readonly programName: string
  readonly programColor: string
  readonly startedAt: Instant
  readonly finishedAt?: Instant | null
  readonly manualStartedAt?: Instant | null
  readonly manualFinishedAt?: Instant | null
  readonly note?: string | null
  readonly createdAt: Instant
  readonly updatedAt: Instant
}

export interface WorkoutItem {
  readonly id: Id
  readonly workoutId: Id
  readonly exerciseId: Id
  /** Снапшот названия упражнения. */
  readonly exerciseName: string
  readonly order: number
  /** Упражнение добавлено сверх программы (FR-4.6). */
  readonly isAdHoc: boolean
  readonly completedAt?: Instant | null
}

export interface WorkoutSet {
  readonly id: Id
  readonly workoutItemId: Id
  readonly order: number
  /** Пустой вес — штатная ситуация: турник, брусья, планка. */
  readonly weightKg?: WeightKg | null
  readonly reps: number
  readonly createdAt: Instant
}

export type AbsenceType = 'vacation' | 'illness' | 'injury' | 'other'

export interface Absence {
  readonly id: Id
  readonly startDate: LocalDate
  readonly endDate: LocalDate
  readonly type: AbsenceType
  readonly note?: string | null
  readonly createdAt: Instant
  readonly updatedAt: Instant
}

export type ThemeMode = 'system' | 'light' | 'dark'
export type LanguageMode = 'system' | 'ru' | 'en'

export interface Settings {
  readonly unit: WeightUnit
  readonly firstDayOfWeek: FirstDayOfWeek
  readonly theme: ThemeMode
  readonly language: LanguageMode
}
