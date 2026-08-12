import { ImportError, SCHEMA_VERSION } from '../../../domain/transfer/types'
import { id, instant, localDate } from '../../../domain/model/types'
import { createFakePorts } from '../../testing/fakes'
import type { FakePorts } from '../../testing/fakes'
import { exportAll, importAll } from '../data'

const at = (iso: string) => instant(Date.parse(iso))
const stamps = { createdAt: at('2026-01-01T00:00:00Z'), updatedAt: at('2026-01-01T00:00:00Z') }
const NOW = at('2026-08-11T18:00:00Z')

const setup = (): FakePorts => {
  const ports = createFakePorts({ now: NOW })
  ports.state.exercises.push({ id: id('e-1'), name: 'Жим лёжа', ...stamps })
  ports.state.programs.push({ id: id('p-1'), name: 'Грудь + трицепс', color: 'prog-red', ...stamps })
  ports.state.programItems.push({ id: id('pi-1'), programId: id('p-1'), exerciseId: id('e-1'), order: 0 })
  ports.state.workouts.push({
    id: id('w-1'),
    date: localDate('2026-08-11'),
    programId: id('p-1'),
    programName: 'Грудь + трицепс',
    programColor: 'prog-red',
    startedAt: at('2026-08-11T15:32:00Z'),
    createdAt: at('2026-08-11T15:32:00Z'),
    updatedAt: at('2026-08-11T15:32:00Z'),
  })
  ports.state.workoutItems.push({
    id: id('wi-1'),
    workoutId: id('w-1'),
    exerciseId: id('e-1'),
    exerciseName: 'Жим лёжа',
    order: 0,
    isAdHoc: false,
    completedAt: at('2026-08-11T16:44:00Z'),
  })
  ports.state.workoutSets.push({
    id: id('ws-1'),
    workoutItemId: id('wi-1'),
    order: 0,
    weightKg: 82.5,
    reps: 6,
    createdAt: at('2026-08-11T16:40:00Z'),
  })
  return ports
}

describe('exportAll (FR-7.1)', () => {
  it('выгружает все коллекции целиком', async () => {
    const bundle = await exportAll(setup())()
    expect(bundle.exercises).toHaveLength(1)
    expect(bundle.workouts).toHaveLength(1)
    expect(bundle.workoutItems).toHaveLength(1)
    expect(bundle.workoutSets).toHaveLength(1)
  })

  it('проставляет версию схемы и время выгрузки из часов', async () => {
    const bundle = await exportAll(setup())()
    expect(bundle.schemaVersion).toBe(SCHEMA_VERSION)
    expect(bundle.exportedAt).toBe(NOW)
  })

  it('выгрузка сериализуется в JSON без потерь', async () => {
    const bundle = await exportAll(setup())()
    expect(JSON.parse(JSON.stringify(bundle))).toEqual(bundle)
  })

  it('пустая база выгружается без ошибок', async () => {
    const bundle = await exportAll(createFakePorts({ now: NOW }))()
    expect(bundle.workouts).toEqual([])
  })
})

describe('importAll — режим «Заменить всё» (FR-7.2)', () => {
  it('текущие данные вытесняются данными файла', async () => {
    const ports = setup()
    const foreign = {
      ...(await exportAll(createFakePorts({ now: NOW }))()),
      exercises: [{ id: 'e-99', name: 'Подтягивания', createdAt: 1, updatedAt: 1 }],
    }

    await importAll(ports)({ raw: JSON.parse(JSON.stringify(foreign)), mode: 'replace' })

    expect(ports.state.exercises.map((e) => e.id)).toEqual(['e-99'])
    expect(ports.state.workouts).toHaveLength(0)
  })

  it('восстановление после полной очистки возвращает состояние один в один (критерий приёмки 10)', async () => {
    const ports = setup()
    const bundle = JSON.parse(JSON.stringify(await exportAll(ports)()))
    const snapshot = JSON.parse(JSON.stringify(ports.state))

    ports.state.exercises = []
    ports.state.programs = []
    ports.state.programItems = []
    ports.state.workouts = []
    ports.state.workoutItems = []
    ports.state.workoutSets = []

    await importAll(ports)({ raw: bundle, mode: 'replace' })

    expect(ports.state.workouts).toEqual(snapshot.workouts)
    expect(ports.state.workoutItems).toEqual(snapshot.workoutItems)
    expect(ports.state.workoutSets).toEqual(snapshot.workoutSets)
  })
})

describe('importAll — режим «Дополнить»', () => {
  it('добавляет недостающие записи и возвращает сводку', async () => {
    const ports = setup()
    const incoming = {
      ...(await exportAll(ports)()),
      exercises: [
        { id: 'e-1', name: 'Жим лёжа', createdAt: 1, updatedAt: 1 },
        { id: 'e-2', name: 'Приседания', createdAt: 1, updatedAt: 1 },
      ],
    }

    const summary = await importAll(ports)({ raw: JSON.parse(JSON.stringify(incoming)), mode: 'merge' })

    expect(ports.state.exercises).toHaveLength(2)
    expect(summary.added).toBeGreaterThanOrEqual(1)
  })

  it('настройки устройства не перезаписываются файлом', async () => {
    const ports = setup()
    ports.state.settings = { ...ports.state.settings, unit: 'kg' }
    const incoming = {
      ...(await exportAll(ports)()),
      settings: { unit: 'lb', firstDayOfWeek: 7, theme: 'dark', language: 'en' },
    }

    await importAll(ports)({ raw: JSON.parse(JSON.stringify(incoming)), mode: 'merge' })

    expect(ports.state.settings.unit).toBe('kg')
  })

  it('повторный импорт того же файла ничего не добавляет', async () => {
    const ports = setup()
    const bundle = JSON.parse(JSON.stringify(await exportAll(ports)()))

    await importAll(ports)({ raw: bundle, mode: 'merge' })
    const summary = await importAll(ports)({ raw: bundle, mode: 'merge' })

    expect(summary.added).toBe(0)
    expect(ports.state.workouts).toHaveLength(1)
  })

  it('импорт не задваивает записи всех коллекций, а не только тренировок', async () => {
    const ports = setup()
    ports.state.absences.push({
      id: id('a-1'),
      startDate: localDate('2026-08-17'),
      endDate: localDate('2026-08-23'),
      type: 'vacation',
      ...stamps,
    })
    const bundle = JSON.parse(JSON.stringify(await exportAll(ports)()))

    await importAll(ports)({ raw: bundle, mode: 'merge' })
    await importAll(ports)({ raw: bundle, mode: 'merge' })

    expect(ports.state.exercises).toHaveLength(1)
    expect(ports.state.programs).toHaveLength(1)
    expect(ports.state.programItems).toHaveLength(1)
    expect(ports.state.workoutItems).toHaveLength(1)
    expect(ports.state.workoutSets).toHaveLength(1)
    expect(ports.state.absences).toHaveLength(1)
  })
})

describe('importAll — испорченные файлы', () => {
  it('чужой файл отклоняется с понятной причиной', async () => {
    const ports = setup()
    await expect(importAll(ports)({ raw: { foo: 'bar' }, mode: 'replace' })).rejects.toBeInstanceOf(
      ImportError,
    )
  })

  it('неудачный импорт не оставляет базу наполовину перезаписанной', async () => {
    const ports = setup()
    // сначала успешный импорт, иначе тест прошёл бы и на полностью нерабочем импорте
    const bundle = JSON.parse(JSON.stringify(await exportAll(ports)()))
    await importAll(ports)({ raw: bundle, mode: 'merge' })
    const before = JSON.parse(JSON.stringify(ports.state))

    await importAll(ports)({
      raw: { schemaVersion: SCHEMA_VERSION, exportedAt: 1, exercises: [] },
      mode: 'replace',
    }).catch(() => undefined)

    expect(ports.state).toEqual(before)
    expect(ports.state.workouts).toHaveLength(1)
  })

  it('версия схемы из будущего отклоняется', async () => {
    const ports = setup()
    const bundle = { ...(await exportAll(ports)()), schemaVersion: SCHEMA_VERSION + 1 }
    await expect(
      importAll(ports)({ raw: JSON.parse(JSON.stringify(bundle)), mode: 'replace' }),
    ).rejects.toMatchObject({ code: 'unsupported-schema-version' })
  })
})
