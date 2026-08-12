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
import { id as makeId, instant } from '../../domain/model/types'
import type { Ports } from '../ports'

/**
 * Тестовые двойники портов: всё в памяти. Сценарные тесты не поднимают SQLite —
 * ради этого в архитектуре и заведены порты (ARCHITECTURE.md §6).
 */

export interface FakeState {
  exercises: Exercise[]
  programs: Program[]
  programItems: ProgramItem[]
  workouts: Workout[]
  workoutItems: WorkoutItem[]
  workoutSets: WorkoutSet[]
  absences: Absence[]
  settings: Settings
}

export const emptyState = (): FakeState => ({
  exercises: [],
  programs: [],
  programItems: [],
  workouts: [],
  workoutItems: [],
  workoutSets: [],
  absences: [],
  settings: { unit: 'kg', firstDayOfWeek: 1, theme: 'system', language: 'system' },
})

export class FixedClock {
  constructor(private current: Instant) {}
  now(): Instant {
    return this.current
  }
  set(at: Instant): void {
    this.current = at
  }
  advance(ms: number): void {
    this.current = instant(this.current + ms)
  }
}

export class SeqIds {
  private n = 0
  constructor(private readonly prefix = 'id') {}
  uuid(): Id {
    this.n += 1
    return makeId(`${this.prefix}-${this.n}`)
  }
}

const inRange = (date: LocalDate, range: DateRange) => date >= range.from && date <= range.to

/** Транзакция, которая откатывает состояние при ошибке — так проверяется атомарность. */
class SnapshotUnitOfWork {
  constructor(private readonly state: FakeState) {}
  async tx<T>(fn: () => Promise<T>): Promise<T> {
    const backup = JSON.parse(JSON.stringify(this.state)) as FakeState
    try {
      return await fn()
    } catch (error) {
      Object.assign(this.state, backup)
      throw error
    }
  }
}

export interface FakePorts extends Ports {
  readonly state: FakeState
  readonly clock: FixedClock
}

export const createFakePorts = (options?: {
  state?: FakeState
  now?: Instant
  timeZone?: string
}): FakePorts => {
  const state = options?.state ?? emptyState()
  const clock = new FixedClock(options?.now ?? instant(Date.parse('2026-08-11T15:32:00Z')))
  const ids = new SeqIds()

  return {
    state,
    clock,
    ids,
    timeZone: options?.timeZone ?? 'Europe/Moscow',
    uow: new SnapshotUnitOfWork(state),

    workouts: {
      async byDate(date) {
        return state.workouts.find((w) => w.date === date) ?? null
      },
      async byId(id) {
        const workout = state.workouts.find((w) => w.id === id)
        if (!workout) return null
        const items = state.workoutItems
          .filter((i) => i.workoutId === id)
          .sort((a, b) => a.order - b.order)
          .map((i) => ({
            ...i,
            sets: state.workoutSets
              .filter((s) => s.workoutItemId === i.id)
              .sort((a, b) => a.order - b.order),
          }))
        return { workout, items }
      },
      async listRange(range) {
        return state.workouts.filter((w) => inRange(w.date, range)).sort((a, b) => a.date.localeCompare(b.date))
      },
      async insert(workout, items) {
        state.workouts.push(workout)
        state.workoutItems.push(...items)
      },
      async update(workout) {
        const index = state.workouts.findIndex((w) => w.id === workout.id)
        if (index >= 0) state.workouts[index] = workout
      },
      async remove(id) {
        const items = state.workoutItems.filter((i) => i.workoutId === id).map((i) => i.id)
        state.workouts = state.workouts.filter((w) => w.id !== id)
        state.workoutItems = state.workoutItems.filter((i) => i.workoutId !== id)
        state.workoutSets = state.workoutSets.filter((s) => !items.includes(s.workoutItemId))
      },
      async addItem(item) {
        state.workoutItems.push(item)
      },
      async addSet(set) {
        state.workoutSets.push(set)
      },
      async setItemCompleted(itemId, at) {
        const index = state.workoutItems.findIndex((i) => i.id === itemId)
        if (index >= 0) state.workoutItems[index] = { ...state.workoutItems[index]!, completedAt: at }
      },
      async lastSetOf(exerciseId, options) {
        const items = state.workoutItems.filter(
          (i) => i.exerciseId === exerciseId && i.workoutId !== options?.exceptWorkoutId,
        )
        const byWorkoutDate = new Map(state.workouts.map((w) => [w.id, w.date]))
        const sets = state.workoutSets
          .filter((s) => items.some((i) => i.id === s.workoutItemId))
          .sort((a, b) => {
            const itemA = items.find((i) => i.id === a.workoutItemId)!
            const itemB = items.find((i) => i.id === b.workoutItemId)!
            const dateA = byWorkoutDate.get(itemA.workoutId) ?? ''
            const dateB = byWorkoutDate.get(itemB.workoutId) ?? ''
            return dateA === dateB ? a.order - b.order : dateA.localeCompare(dateB)
          })
        return sets.at(-1) ?? null
      },
    },

    programs: {
      async byId(id) {
        return state.programs.find((p) => p.id === id) ?? null
      },
      async byIdWithItems(id) {
        const program = state.programs.find((p) => p.id === id)
        if (!program) return null
        const items = state.programItems
          .filter((i) => i.programId === id)
          .sort((a, b) => a.order - b.order)
          .map((i) => ({
            ...i,
            exerciseName: state.exercises.find((e) => e.id === i.exerciseId)?.name ?? '',
          }))
        return { program, items }
      },
      async list(options) {
        return state.programs.filter((p) => options?.includeArchived || !p.archivedAt)
      },
      async insert(program, items) {
        state.programs.push(program)
        state.programItems.push(...items)
      },
      async update(program) {
        const index = state.programs.findIndex((p) => p.id === program.id)
        if (index >= 0) state.programs[index] = program
      },
      async replaceItems(programId, items) {
        state.programItems = state.programItems.filter((i) => i.programId !== programId)
        state.programItems.push(...items)
      },
      async remove(id) {
        state.programs = state.programs.filter((p) => p.id !== id)
        state.programItems = state.programItems.filter((i) => i.programId !== id)
      },
    },

    exercises: {
      async byId(id) {
        return state.exercises.find((e) => e.id === id) ?? null
      },
      async list(options) {
        return state.exercises.filter((e) => options?.includeArchived || !e.archivedAt)
      },
      async insert(exercise) {
        state.exercises.push(exercise)
      },
      async update(exercise) {
        const index = state.exercises.findIndex((e) => e.id === exercise.id)
        if (index >= 0) state.exercises[index] = exercise
      },
      async remove(id) {
        state.exercises = state.exercises.filter((e) => e.id !== id)
      },
      async isUsed(id) {
        return state.workoutItems.some((i) => i.exerciseId === id)
      },
    },

    absences: {
      async listRange(range) {
        return state.absences.filter((a) => a.startDate <= range.to && a.endDate >= range.from)
      },
      async insert(absence) {
        state.absences.push(absence)
      },
      async remove(id) {
        state.absences = state.absences.filter((a) => a.id !== id)
      },
    },

    settings: {
      async get() {
        return state.settings
      },
      async set(next) {
        state.settings = next
      },
    },
  }
}
