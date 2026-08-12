import { buildBundle, mergeBundles, parseBundle } from '../../domain/transfer/bundle'
import type { ExportBundle, ImportMode, MergeSummary } from '../../domain/transfer/types'
import type { Ports } from '../ports'

/** Экспорт и импорт (FR-7.1, FR-7.2). Файловый ввод-вывод остаётся в infra. */

const FAR_PAST = '0000-01-01' as never
const FAR_FUTURE = '9999-12-31' as never

/** Полный снимок базы. Диапазон намеренно бесконечный: выгружается всё. */
const readEverything = async (p: Ports): Promise<Omit<ExportBundle, 'schemaVersion' | 'exportedAt'>> => {
  const [exercises, programs, workouts, absences, settings] = await Promise.all([
    p.exercises.list({ includeArchived: true }),
    p.programs.list({ includeArchived: true }),
    p.workouts.listRange({ from: FAR_PAST, to: FAR_FUTURE }),
    p.absences.listRange({ from: FAR_PAST, to: FAR_FUTURE }),
    p.settings.get(),
  ])

  const programItems = (
    await Promise.all(programs.map((program) => p.programs.byIdWithItems(program.id)))
  ).flatMap((entry) => entry?.items.map(({ exerciseName, ...item }) => item) ?? [])

  const aggregates = (await Promise.all(workouts.map((workout) => p.workouts.byId(workout.id)))).filter(
    (aggregate): aggregate is NonNullable<typeof aggregate> => aggregate !== null,
  )

  return {
    exercises,
    programs,
    programItems,
    workouts,
    workoutItems: aggregates.flatMap((aggregate) => aggregate.items.map(({ sets, ...item }) => item)),
    workoutSets: aggregates.flatMap((aggregate) => aggregate.items.flatMap((item) => item.sets)),
    absences,
    settings,
  }
}

export const exportAll = (p: Ports) => async (): Promise<ExportBundle> =>
  buildBundle(await readEverything(p), p.clock.now())

export const importAll =
  (p: Ports) =>
  async (input: { readonly raw: unknown; readonly mode: ImportMode }): Promise<MergeSummary> => {
    // разбор до любых записей в базу: испорченный файл не должен ничего менять
    const incoming = parseBundle(input.raw)
    const current = await exportAll(p)()
    const { bundle, summary } = mergeBundles(current, incoming, input.mode)

    await p.uow.tx(async () => {
      // база очищается целиком: слияние уже посчитано, дальше пишется готовый результат
      for (const workout of current.workouts) {
        await p.workouts.remove(workout.id)
      }
      for (const program of current.programs) {
        await p.programs.remove(program.id)
      }
      for (const absence of current.absences) {
        await p.absences.remove(absence.id)
      }
      for (const exercise of current.exercises) {
        await p.exercises.remove(exercise.id)
      }

      for (const exercise of bundle.exercises) {
        await p.exercises.insert(exercise)
      }
      for (const program of bundle.programs) {
        await p.programs.insert(
          program,
          bundle.programItems.filter((item) => item.programId === program.id),
        )
      }
      for (const workout of bundle.workouts) {
        await p.workouts.insert(
          workout,
          bundle.workoutItems.filter((item) => item.workoutId === workout.id),
        )
      }
      for (const set of bundle.workoutSets) {
        await p.workouts.addSet(set)
      }
      for (const absence of bundle.absences) {
        await p.absences.insert(absence)
      }
      if (input.mode === 'replace') {
        await p.settings.set(bundle.settings)
      }
    })

    return summary
  }
