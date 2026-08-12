import { useQuery } from '@tanstack/react-query'
import type { Ports } from '../../../app/ports'
import type { Exercise, Program } from '../../../domain/model/entities'
import type { LocalDate, WeightKg, WeightUnit } from '../../../domain/model/types'
import { localDate } from '../../../domain/model/types'
import { EMPTY_VALUE, formatSet, formatWeight } from '../../../domain/rules/format'
import type { Locale } from '../../../domain/rules/format'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useServices } from '../../providers/ServicesProvider'
import { SETTINGS_QUERY_KEY } from '../../providers/SettingsProvider'

/**
 * Данные библиотеки: экраны получают готовые сводки, а не ходят в порты по одному.
 * Здесь только сборка представления — правила расчётов живут в domain.
 */

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

export interface ExerciseSummary {
  readonly exercise: Exercise
  /** Дата последней тренировки с этим упражнением. */
  readonly lastDate: LocalDate | null
  /** Рекордный вес в килограммах; null — упражнение всегда шло без веса. */
  readonly recordKg: WeightKg | null
  readonly recordReps: number | null
  /** Сколько раз упражнение встречалось в тренировках — сортировка по частоте. */
  readonly usageCount: number
}

export interface ProgramSummary {
  readonly program: Program
  readonly exerciseCount: number
}

/** Порядок групп из макета; чужие значения показываются как есть после известных. */
export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'other'] as const

export type MuscleGroupKey = (typeof MUSCLE_GROUPS)[number]

const GROUP_LABEL_KEYS: Record<MuscleGroupKey, TranslationKey> = {
  chest: 'library.muscleGroup.chest',
  back: 'library.muscleGroup.back',
  legs: 'library.muscleGroup.legs',
  shoulders: 'library.muscleGroup.shoulders',
  arms: 'library.muscleGroup.arms',
  core: 'library.muscleGroup.core',
  other: 'library.muscleGroup.other',
}

const MONTH_SHORT_KEYS: readonly TranslationKey[] = [
  'calendar.monthShort.1',
  'calendar.monthShort.2',
  'calendar.monthShort.3',
  'calendar.monthShort.4',
  'calendar.monthShort.5',
  'calendar.monthShort.6',
  'calendar.monthShort.7',
  'calendar.monthShort.8',
  'calendar.monthShort.9',
  'calendar.monthShort.10',
  'calendar.monthShort.11',
  'calendar.monthShort.12',
]

const isKnownGroup = (value: string): value is MuscleGroupKey =>
  (MUSCLE_GROUPS as readonly string[]).includes(value)

/** Название группы: известный ключ переводится, произвольное значение остаётся данными. */
export const muscleGroupLabel = (group: string, t: Translate): string =>
  isKnownGroup(group) ? t(GROUP_LABEL_KEYS[group]) : group

export const formatShortDate = (date: LocalDate, t: Translate): string => {
  const [, month, day] = date.split('-')
  const key = MONTH_SHORT_KEYS[Number(month) - 1]
  return key ? `${Number(day)} ${t(key)}` : date
}

/** Рекорд в строке списка: вес, а без веса — лучшее число повторов. */
export const formatRecord = (
  summary: ExerciseSummary,
  unit: WeightUnit,
  locale: Locale,
): string => {
  if (summary.recordKg !== null) return formatWeight(summary.recordKg, unit, locale)
  if (summary.recordReps !== null) return formatSet({ weightKg: null, reps: summary.recordReps }, unit)
  return EMPTY_VALUE
}

/** Вся история целиком: диапазон шире любой мыслимой даты тренировки. */
const WHOLE_HISTORY = { from: localDate('0001-01-01'), to: localDate('9999-12-31') }

interface Aggregate {
  last: LocalDate | null
  kg: WeightKg | null
  reps: number | null
  count: number
}

export const loadExerciseSummaries = async (ports: Ports): Promise<readonly ExerciseSummary[]> => {
  const exercises = await ports.exercises.list()
  const workouts = await ports.workouts.listRange(WHOLE_HISTORY)
  const aggregates = await Promise.all(workouts.map((workout) => ports.workouts.byId(workout.id)))

  const stats = new Map<string, Aggregate>()
  for (const aggregate of aggregates) {
    if (!aggregate) continue

    for (const item of aggregate.items) {
      const current: Aggregate = stats.get(item.exerciseId) ?? { last: null, kg: null, reps: null, count: 0 }
      current.count += 1
      if (current.last === null || aggregate.workout.date > current.last) {
        current.last = aggregate.workout.date
      }
      for (const set of item.sets) {
        const weight = set.weightKg ?? null
        if (weight !== null) current.kg = current.kg === null ? weight : Math.max(current.kg, weight)
        current.reps = current.reps === null ? set.reps : Math.max(current.reps, set.reps)
      }
      stats.set(item.exerciseId, current)
    }
  }

  return exercises.map((exercise) => {
    const aggregate = stats.get(exercise.id)
    return {
      exercise,
      lastDate: aggregate?.last ?? null,
      recordKg: aggregate?.kg ?? null,
      recordReps: aggregate?.reps ?? null,
      usageCount: aggregate?.count ?? 0,
    }
  })
}

export const loadProgramSummaries = async (ports: Ports): Promise<readonly ProgramSummary[]> => {
  const programs = await ports.programs.list()
  const details = await Promise.all(programs.map((program) => ports.programs.byIdWithItems(program.id)))
  return programs.map((program, index) => ({
    program,
    exerciseCount: details[index]?.items.length ?? 0,
  }))
}

export type SortMode = 'alphabet' | 'frequency' | 'date'

export const sortSummaries = (
  summaries: readonly ExerciseSummary[],
  mode: SortMode,
): readonly ExerciseSummary[] => {
  const byName = (a: ExerciseSummary, b: ExerciseSummary) => a.exercise.name.localeCompare(b.exercise.name)

  return [...summaries].sort((a, b) => {
    if (mode === 'frequency' && a.usageCount !== b.usageCount) return b.usageCount - a.usageCount
    if (mode === 'date' && a.lastDate !== b.lastDate) {
      if (a.lastDate === null) return 1
      if (b.lastDate === null) return -1
      return b.lastDate.localeCompare(a.lastDate)
    }
    return byName(a, b)
  })
}

export interface MuscleGroupSection {
  readonly group: string
  readonly items: readonly ExerciseSummary[]
}

/** Группировка по мышцам с сохранением порядка внутри группы (FR-2.2). */
export const groupByMuscle = (
  summaries: readonly ExerciseSummary[],
): readonly MuscleGroupSection[] => {
  const sections = new Map<string, ExerciseSummary[]>()
  for (const summary of summaries) {
    const group = summary.exercise.muscleGroup?.trim() || 'other'
    const existing = sections.get(group)
    if (existing) existing.push(summary)
    else sections.set(group, [summary])
  }

  const weight = (group: string): number => {
    const index = (MUSCLE_GROUPS as readonly string[]).indexOf(group)
    return index === -1 ? MUSCLE_GROUPS.length : index
  }

  return [...sections.entries()]
    .map(([group, items]) => ({ group, items }))
    .sort((a, b) => weight(a.group) - weight(b.group) || a.group.localeCompare(b.group))
}

export const matchesQuery = (name: string, query: string): boolean =>
  name.toLowerCase().includes(query.trim().toLowerCase())

export const useExerciseSummaries = () => {
  const { ports } = useServices()
  return useQuery({
    queryKey: ['library', 'exercises'],
    queryFn: () => loadExerciseSummaries(ports),
  })
}

export const useProgramSummaries = () => {
  const { ports } = useServices()
  return useQuery({
    queryKey: ['library', 'programs'],
    queryFn: () => loadProgramSummaries(ports),
  })
}

/** Единицы веса из настроек: в базе всегда килограммы (FR-7.5). */
export const useWeightUnit = (): WeightUnit => {
  const { ports } = useServices()
  const { data } = useQuery({ queryKey: SETTINGS_QUERY_KEY, queryFn: () => ports.settings.get() })
  return data?.unit ?? 'kg'
}
