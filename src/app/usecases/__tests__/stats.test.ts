import { OUTLIER_THRESHOLD_MS } from '../../../domain/rules/duration'
import { id, instant, localDate } from '../../../domain/model/types'
import { createFakePorts } from '../../testing/fakes'
import type { FakePorts } from '../../testing/fakes'
import { monthStats } from '../stats'

const at = (iso: string) => instant(Date.parse(iso))
const d = (s: string) => localDate(s)
const stamps = { createdAt: at('2026-01-01T00:00:00Z'), updatedAt: at('2026-01-01T00:00:00Z') }
const AUGUST = d('2026-08-11')
const TODAY = d('2026-08-31')

const setup = (): FakePorts => {
  const ports = createFakePorts({ now: at('2026-08-31T12:00:00Z') })
  ports.state.programs.push(
    { id: id('p-1'), name: 'Грудь + трицепс', color: 'prog-red', ...stamps },
    { id: id('p-2'), name: 'Спина + бицепс', color: 'prog-blue', ...stamps },
  )
  return ports
}

/** Тренировка с заданной длительностью и долей выполненных упражнений. */
const addWorkout = (
  ports: FakePorts,
  options: {
    date: string
    programId?: string
    durationMs?: number | null
    done?: number
    total?: number
  },
) => {
  const workoutId = id(`w-${options.date}`)
  const startedAt = at(`${options.date}T15:00:00Z`)
  const total = options.total ?? 5
  const done = options.done ?? total

  ports.state.workouts.push({
    id: workoutId,
    date: d(options.date),
    programId: id(options.programId ?? 'p-1'),
    programName: options.programId === 'p-2' ? 'Спина + бицепс' : 'Грудь + трицепс',
    programColor: options.programId === 'p-2' ? 'prog-blue' : 'prog-red',
    startedAt,
    finishedAt: options.durationMs == null ? null : instant(startedAt + options.durationMs),
    createdAt: startedAt,
    updatedAt: startedAt,
  })

  for (let i = 0; i < total; i++) {
    const isDone = i < done
    ports.state.workoutItems.push({
      id: id(`wi-${options.date}-${i}`),
      workoutId,
      exerciseId: id('e-1'),
      exerciseName: 'Жим лёжа',
      order: i,
      isAdHoc: false,
      completedAt:
        isDone && options.durationMs != null ? instant(startedAt + options.durationMs) : null,
    })
  }
}

const hour = 60 * 60 * 1000
const min = 60 * 1000

describe('monthStats (FR-6.2)', () => {
  it('считает количество тренировок за месяц', async () => {
    const ports = setup()
    addWorkout(ports, { date: '2026-08-03' })
    addWorkout(ports, { date: '2026-08-05' })
    addWorkout(ports, { date: '2026-07-30' })
    addWorkout(ports, { date: '2026-09-01' })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.workouts).toBe(2)
  })

  it('среднее в неделю учитывает вычет отпускных недель', async () => {
    const ports = setup()
    for (const date of ['2026-08-03', '2026-08-05', '2026-08-10', '2026-08-24', '2026-08-26']) {
      addWorkout(ports, { date })
    }
    ports.state.absences.push({
      id: id('a-1'),
      startDate: d('2026-08-17'),
      endDate: d('2026-08-23'),
      type: 'vacation',
      ...stamps,
    })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.perWeek).toBeCloseTo(5 / 5, 5)
  })

  it('средняя длительность исключает выбросы (§5.1)', async () => {
    const ports = setup()
    addWorkout(ports, { date: '2026-08-03', durationMs: hour })
    addWorkout(ports, { date: '2026-08-05', durationMs: 2 * hour })
    addWorkout(ports, { date: '2026-08-07', durationMs: OUTLIER_THRESHOLD_MS + min })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.averageDurationMs).toBe(1.5 * hour)
  })

  it('тренировки без отметок не занижают среднюю длительность', async () => {
    const ports = setup()
    addWorkout(ports, { date: '2026-08-03', durationMs: hour })
    addWorkout(ports, { date: '2026-08-05', durationMs: null, done: 0 })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.averageDurationMs).toBe(hour)
  })

  it('месяц без единой достоверной длительности даёт null, а не ноль (FR-6.4)', async () => {
    const ports = setup()
    addWorkout(ports, { date: '2026-08-03', durationMs: null, done: 0 })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.averageDurationMs).toBeNull()
  })

  it('считает среднюю завершённость', async () => {
    const ports = setup()
    addWorkout(ports, { date: '2026-08-03', durationMs: hour, done: 5, total: 5 })
    addWorkout(ports, { date: '2026-08-05', durationMs: hour, done: 3, total: 5 })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.completionRate).toBeCloseTo(0.8, 5)
  })

  it('распределение по программам считается по снапшотам и отсортировано по убыванию', async () => {
    const ports = setup()
    addWorkout(ports, { date: '2026-08-03', programId: 'p-1', durationMs: hour })
    addWorkout(ports, { date: '2026-08-05', programId: 'p-2', durationMs: hour })
    addWorkout(ports, { date: '2026-08-07', programId: 'p-1', durationMs: hour })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.byProgram).toEqual([
      { programId: 'p-1', name: 'Грудь + трицепс', color: 'prog-red', count: 2 },
      { programId: 'p-2', name: 'Спина + бицепс', color: 'prog-blue', count: 1 },
    ])
  })

  it('программы без тренировок в диаграмму не попадают (FR-3.7)', async () => {
    const ports = setup()
    addWorkout(ports, { date: '2026-08-03', programId: 'p-1', durationMs: hour })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.byProgram.map((p) => p.programId)).toEqual(['p-1'])
  })

  it('считает дни отсутствия, ограничивая их месяцем', async () => {
    const ports = setup()
    ports.state.absences.push({
      id: id('a-1'),
      startDate: d('2026-07-28'),
      endDate: d('2026-08-02'),
      type: 'vacation',
      ...stamps,
    })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.absenceDays).toBe(2)
  })

  it('пустой месяц не ломается и не делит на ноль', async () => {
    const ports = setup()
    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.workouts).toBe(0)
    expect(stats.perWeek).toBe(0)
    expect(stats.averageDurationMs).toBeNull()
    expect(stats.completionRate).toBeNull()
    expect(stats.byProgram).toEqual([])
  })

  it('месяц целиком в отпуске: среднее в неделю — null', async () => {
    const ports = setup()
    ports.state.absences.push({
      id: id('a-1'),
      startDate: d('2026-07-27'),
      endDate: d('2026-09-06'),
      type: 'vacation',
      ...stamps,
    })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: TODAY })
    expect(stats.perWeek).toBeNull()
  })

  it('серия недель приезжает вместе с остальной сводкой', async () => {
    const ports = setup()
    addWorkout(ports, { date: '2026-08-17', durationMs: hour })
    addWorkout(ports, { date: '2026-08-24', durationMs: hour })

    const stats = await monthStats(ports)({ anyDateOfMonth: AUGUST, today: d('2026-08-26') })
    expect(stats.streak.current).toBe(2)
  })
})
