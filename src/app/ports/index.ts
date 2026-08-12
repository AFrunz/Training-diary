import type {
  Absence,
  Exercise,
  Program,
  ProgramItem,
  Settings,
  Workout,
  WorkoutItem,
  WorkoutSet,
} from '../../domain/model/entities'
import type { DateRange, Id, Instant, LocalDate } from '../../domain/model/types'

/**
 * Интерфейсы внешнего мира. Сценарии зависят только от них, а не от SQLite,
 * файловой системы и системных часов (ARCHITECTURE.md §1).
 */

export interface Clock {
  now(): Instant
}

export interface IdGenerator {
  uuid(): Id
}

export interface UnitOfWork {
  /** Выполняет операции атомарно: либо всё, либо ничего. */
  tx<T>(fn: () => Promise<T>): Promise<T>
}

/** Тренировка вместе с упражнениями и подходами. */
export interface WorkoutAggregate {
  readonly workout: Workout
  readonly items: readonly (WorkoutItem & { readonly sets: readonly WorkoutSet[] })[]
}

export interface WorkoutRepo {
  byDate(date: LocalDate): Promise<Workout | null>
  byId(id: Id): Promise<WorkoutAggregate | null>
  listRange(range: DateRange): Promise<readonly Workout[]>
  insert(workout: Workout, items: readonly WorkoutItem[]): Promise<void>
  update(workout: Workout): Promise<void>
  remove(id: Id): Promise<void>
  addItem(item: WorkoutItem): Promise<void>
  addSet(set: WorkoutSet): Promise<void>
  setItemCompleted(itemId: Id, at: Instant | null): Promise<void>
  /** Последний записанный подход упражнения — для предзаполнения полей (FR-4.4). */
  lastSetOf(exerciseId: Id, options?: { readonly exceptWorkoutId?: Id }): Promise<WorkoutSet | null>
}

export interface ProgramWithItems {
  readonly program: Program
  readonly items: readonly (ProgramItem & { readonly exerciseName: string })[]
}

export interface ProgramRepo {
  byId(id: Id): Promise<Program | null>
  byIdWithItems(id: Id): Promise<ProgramWithItems | null>
  list(options?: { readonly includeArchived?: boolean }): Promise<readonly Program[]>
  insert(program: Program, items: readonly ProgramItem[]): Promise<void>
  update(program: Program): Promise<void>
  replaceItems(programId: Id, items: readonly ProgramItem[]): Promise<void>
  /** Нужно импорту в режиме «Заменить всё»: в интерфейсе программы только архивируются. */
  remove(id: Id): Promise<void>
}

export interface ExerciseRepo {
  byId(id: Id): Promise<Exercise | null>
  list(options?: { readonly includeArchived?: boolean }): Promise<readonly Exercise[]>
  insert(exercise: Exercise): Promise<void>
  update(exercise: Exercise): Promise<void>
  remove(id: Id): Promise<void>
  /** Использовано ли упражнение хотя бы в одной тренировке (FR-2.4). */
  isUsed(id: Id): Promise<boolean>
}

export interface AbsenceRepo {
  listRange(range: DateRange): Promise<readonly Absence[]>
  insert(absence: Absence): Promise<void>
  remove(id: Id): Promise<void>
}

export interface SettingsStore {
  get(): Promise<Settings>
  set(settings: Settings): Promise<void>
}

export interface Ports {
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly uow: UnitOfWork
  readonly workouts: WorkoutRepo
  readonly programs: ProgramRepo
  readonly exercises: ExerciseRepo
  readonly absences: AbsenceRepo
  readonly settings: SettingsStore
  /** Зона устройства: нужна, чтобы отличить «сегодня» от «задним числом». */
  readonly timeZone: string
}
