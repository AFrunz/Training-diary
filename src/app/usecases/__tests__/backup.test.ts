import { id, instant, localDate } from '../../../domain/model/types'
import { createFakePorts } from '../../testing/fakes'
import type { FakePorts } from '../../testing/fakes'
import {
  BACKUPS_KEPT,
  exportToFile,
  importFromFile,
  restoreBackup,
  runBackup,
  wipeAllData,
} from '../backup'
import { exportAll } from '../data'
import { createExercise, createProgram } from '../library'
import { createWorkout } from '../workouts'

const at = (iso: string) => instant(Date.parse(iso))
const NOW = at('2026-08-11T18:00:00Z')

/** Небольшая, но полная база: упражнение, программа, тренировка. */
const seeded = async (): Promise<FakePorts> => {
  const ports = createFakePorts({ now: NOW })
  const exerciseId = await createExercise(ports)({ name: 'Жим лёжа' })
  const programId = await createProgram(ports)({ name: 'Грудь + трицепс', exerciseIds: [exerciseId] })
  await createWorkout(ports)({ date: localDate('2026-08-11'), programId })
  return ports
}

describe('exportToFile (FR-7.1)', () => {
  it('сохраняет файл с датой в имени и предлагает поделиться', async () => {
    const ports = await seeded()
    const path = await exportToFile(ports)()

    expect(path).toBe('/exports/training-diary-2026-08-11.json')
    expect(ports.state.files.shared).toEqual([path])
  })

  it('имя файла берёт локальную дату, а не UTC', async () => {
    // 21:30 UTC — это уже 12 августа по Москве
    const ports = createFakePorts({ now: at('2026-08-11T21:30:00Z') })
    const path = await exportToFile(ports)()

    expect(path).toContain('2026-08-12')
  })

  it('в файл попадает вся база', async () => {
    const ports = await seeded()
    const path = await exportToFile(ports)()

    const saved = ports.state.files.exports[path] as { workouts: unknown[]; exercises: unknown[] }
    expect(saved.workouts).toHaveLength(1)
    expect(saved.exercises).toHaveLength(1)
  })
})

describe('importFromFile (FR-7.2)', () => {
  it('отменённый выбор файла ничего не меняет', async () => {
    const ports = await seeded()
    ports.state.files.picked = null

    const result = await importFromFile(ports)('replace')

    expect(result.cancelled).toBe(true)
    expect(ports.state.workouts).toHaveLength(1)
  })

  it('вливает выбранный файл и возвращает сводку', async () => {
    const source = await seeded()
    const bundle = JSON.parse(JSON.stringify(await exportAll(source)()))

    const target = createFakePorts({ now: NOW })
    target.state.files.picked = bundle

    const result = await importFromFile(target)('merge')

    expect(result.cancelled).toBe(false)
    expect(result.summary!.added).toBeGreaterThan(0)
    expect(target.state.workouts).toHaveLength(1)
  })

  it('перед импортом снимается автобэкап: откатиться будет чем', async () => {
    const source = await seeded()
    const bundle = JSON.parse(JSON.stringify(await exportAll(source)()))

    const target = await seeded()
    target.state.files.picked = bundle

    await importFromFile(target)('replace')

    expect(Object.keys(target.state.files.backups)).toHaveLength(1)
  })

  it('испорченный файл отклоняется, а снятый бэкап остаётся', async () => {
    const ports = await seeded()
    ports.state.files.picked = { что: 'угодно' }

    await expect(importFromFile(ports)('replace')).rejects.toMatchObject({ name: 'ImportError' })
    expect(Object.keys(ports.state.files.backups)).toHaveLength(1)
    expect(ports.state.workouts).toHaveLength(1)
  })
})

describe('runBackup (FR-7.3)', () => {
  it('кладёт снимок базы в автобэкапы', async () => {
    const ports = await seeded()
    const fileName = await runBackup(ports)()

    const saved = ports.state.files.backups[fileName] as { workouts: unknown[] }
    expect(saved.workouts).toHaveLength(1)
  })

  it('хранит только пять последних копий', async () => {
    const ports = await seeded()

    for (let i = 0; i < BACKUPS_KEPT + 3; i++) {
      ports.clock.advance(60_000)
      await runBackup(ports)()
    }

    expect(Object.keys(ports.state.files.backups)).toHaveLength(BACKUPS_KEPT)
  })

  it('при ротации удаляются самые старые, а свежие остаются', async () => {
    const ports = await seeded()
    const names: string[] = []

    for (let i = 0; i < BACKUPS_KEPT + 2; i++) {
      ports.clock.advance(60_000)
      names.push(await runBackup(ports)())
    }

    expect(ports.state.files.backups[names[0]!]).toBeUndefined()
    expect(ports.state.files.backups[names.at(-1)!]).toBeDefined()
  })
})

describe('restoreBackup', () => {
  it('возвращает состояние из копии, вытесняя текущее', async () => {
    const ports = await seeded()
    const fileName = await runBackup(ports)()

    await wipeAllData(ports)()
    expect(ports.state.workouts).toHaveLength(0)

    await restoreBackup(ports)(fileName)
    expect(ports.state.workouts).toHaveLength(1)
    expect(ports.state.exercises).toHaveLength(1)
  })

  it('несуществующая копия — понятная ошибка', async () => {
    const ports = await seeded()
    await expect(restoreBackup(ports)('нет-такого.json')).rejects.toMatchObject({ name: 'ImportError' })
  })
})

describe('wipeAllData (FR-7.4)', () => {
  it('стирает тренировки, программы, упражнения и отсутствия', async () => {
    const ports = await seeded()
    ports.state.absences.push({
      id: id('a-1'),
      startDate: localDate('2026-08-17'),
      endDate: localDate('2026-08-23'),
      type: 'vacation',
      createdAt: NOW,
      updatedAt: NOW,
    })

    await wipeAllData(ports)()

    expect(ports.state.workouts).toHaveLength(0)
    expect(ports.state.workoutItems).toHaveLength(0)
    expect(ports.state.workoutSets).toHaveLength(0)
    expect(ports.state.programs).toHaveLength(0)
    expect(ports.state.programItems).toHaveLength(0)
    expect(ports.state.exercises).toHaveLength(0)
    expect(ports.state.absences).toHaveLength(0)
  })

  it('настройки устройства остаются', async () => {
    const ports = await seeded()
    await ports.settings.set({ ...ports.state.settings, unit: 'lb', theme: 'dark' })

    await wipeAllData(ports)()

    expect(ports.state.settings.unit).toBe('lb')
    expect(ports.state.settings.theme).toBe('dark')
  })

  it('на пустой базе не падает', async () => {
    const ports = createFakePorts({ now: NOW })
    await expect(wipeAllData(ports)()).resolves.toBeUndefined()
  })
})
