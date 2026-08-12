import { id, instant, localDate } from '../../../domain/model/types'
import { createFakePorts } from '../../testing/fakes'
import { createAbsence, deleteAbsence } from '../absences'
import { monthStats } from '../stats'

const at = (iso: string) => instant(Date.parse(iso))
const d = (s: string) => localDate(s)
const NOW = at('2026-08-11T15:32:00Z')

const setup = () => createFakePorts({ now: NOW })
const ALL_TIME = { from: d('0000-01-01'), to: d('9999-12-31') }

describe('createAbsence (FR-1.6)', () => {
  it('заводит отсутствие с типом и заметкой', async () => {
    const ports = setup()
    const absenceId = await createAbsence(ports)({
      startDate: d('2026-08-17'),
      endDate: d('2026-08-23'),
      type: 'vacation',
      note: 'Турция',
    })

    const [absence] = await ports.absences.listRange(ALL_TIME)
    expect(absence).toMatchObject({
      id: absenceId,
      startDate: '2026-08-17',
      endDate: '2026-08-23',
      type: 'vacation',
      note: 'Турция',
    })
  })

  it('проставляет время создания по часам', async () => {
    const ports = setup()
    await createAbsence(ports)({ startDate: d('2026-08-17'), endDate: d('2026-08-17'), type: 'illness' })

    const [absence] = await ports.absences.listRange(ALL_TIME)
    expect(absence!.createdAt).toBe(NOW)
  })

  it('отсутствие на один день допустимо', async () => {
    const ports = setup()
    await expect(
      createAbsence(ports)({ startDate: d('2026-08-17'), endDate: d('2026-08-17'), type: 'other' }),
    ).resolves.toBeDefined()
  })

  it('конец раньше начала отклоняется и ничего не пишет', async () => {
    const ports = setup()
    await expect(
      createAbsence(ports)({ startDate: d('2026-08-23'), endDate: d('2026-08-17'), type: 'vacation' }),
    ).rejects.toMatchObject({ code: 'range-inverted' })

    expect(ports.state.absences).toHaveLength(0)
  })

  it('отсутствие длиннее года отклоняется', async () => {
    const ports = setup()
    await expect(
      createAbsence(ports)({ startDate: d('2026-01-01'), endDate: d('2027-06-01'), type: 'vacation' }),
    ).rejects.toMatchObject({ code: 'range-too-long' })
  })

  it('пересекающиеся отсутствия разрешены: болезнь может попасть в отпуск', async () => {
    const ports = setup()
    await createAbsence(ports)({ startDate: d('2026-08-17'), endDate: d('2026-08-23'), type: 'vacation' })
    await expect(
      createAbsence(ports)({ startDate: d('2026-08-20'), endDate: d('2026-08-25'), type: 'illness' }),
    ).resolves.toBeDefined()
  })

  it('заведённое отсутствие сразу влияет на регулярность (§5.3)', async () => {
    const ports = setup()
    ports.state.programs.push({
      id: id('p-1'),
      name: 'Грудь + трицепс',
      color: 'prog-red',
      createdAt: NOW,
      updatedAt: NOW,
    })
    for (const date of ['2026-08-03', '2026-08-10', '2026-08-24']) {
      ports.state.workouts.push({
        id: id(`w-${date}`),
        date: d(date),
        programId: id('p-1'),
        programName: 'Грудь + трицепс',
        programColor: 'prog-red',
        startedAt: at(`${date}T15:00:00Z`),
        createdAt: at(`${date}T15:00:00Z`),
        updatedAt: at(`${date}T15:00:00Z`),
      })
    }

    const before = await monthStats(ports)({ anyDateOfMonth: d('2026-08-11'), today: d('2026-08-31') })
    await createAbsence(ports)({ startDate: d('2026-08-17'), endDate: d('2026-08-23'), type: 'vacation' })
    const after = await monthStats(ports)({ anyDateOfMonth: d('2026-08-11'), today: d('2026-08-31') })

    // отпускная неделя ушла из знаменателя, поэтому среднее выросло
    expect(after.perWeek!).toBeGreaterThan(before.perWeek!)
    expect(after.absenceDays).toBe(7)
  })
})

describe('deleteAbsence', () => {
  it('удаляет отсутствие', async () => {
    const ports = setup()
    const absenceId = await createAbsence(ports)({
      startDate: d('2026-08-17'),
      endDate: d('2026-08-23'),
      type: 'vacation',
    })

    await deleteAbsence(ports)(absenceId)
    expect(await ports.absences.listRange(ALL_TIME)).toHaveLength(0)
  })

  it('несуществующее отсутствие — ошибка «не найдено»', async () => {
    const ports = setup()
    await expect(deleteAbsence(ports)(id('нет-такого'))).rejects.toMatchObject({ name: 'NotFound' })
  })
})
