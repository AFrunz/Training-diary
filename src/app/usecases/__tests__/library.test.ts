import { id, instant, localDate } from '../../../domain/model/types'
import { createFakePorts } from '../../testing/fakes'
import type { FakePorts } from '../../testing/fakes'
import {
  archiveProgram,
  createExercise,
  createProgram,
  duplicateProgram,
  removeExercise,
  renameProgram,
  setProgramItems,
  suggestProgramColor,
} from '../library'
import { createWorkout } from '../workouts'

const at = (iso: string) => instant(Date.parse(iso))
const NOW = at('2026-08-11T15:32:00Z')
const stamps = { createdAt: at('2026-01-01T00:00:00Z'), updatedAt: at('2026-01-01T00:00:00Z') }

const setup = (): FakePorts => createFakePorts({ now: NOW })

const withExercises = (ports: FakePorts) => {
  ports.state.exercises.push(
    { id: id('e-1'), name: 'Жим лёжа', ...stamps },
    { id: id('e-2'), name: 'Приседания со штангой', ...stamps },
  )
}

describe('createExercise (FR-2.1.1)', () => {
  it('создаёт упражнение с указанными полями', async () => {
    const ports = setup()
    const exerciseId = await createExercise(ports)({ name: 'Тяга верхнего блока', muscleGroup: 'Спина' })
    const created = await ports.exercises.byId(exerciseId)
    expect(created).toMatchObject({ name: 'Тяга верхнего блока', muscleGroup: 'Спина' })
  })

  it('обрезает краевые пробелы в названии', async () => {
    const ports = setup()
    const exerciseId = await createExercise(ports)({ name: '  Планка  ' })
    expect((await ports.exercises.byId(exerciseId))!.name).toBe('Планка')
  })

  it('пустое название отклоняется', async () => {
    const ports = setup()
    await expect(createExercise(ports)({ name: '   ' })).rejects.toMatchObject({ code: 'name-empty' })
  })

  it('дубликат без учёта регистра отклоняется', async () => {
    const ports = setup()
    withExercises(ports)
    await expect(createExercise(ports)({ name: 'жим лёжа' })).rejects.toMatchObject({
      code: 'name-duplicate',
    })
  })

  it('архивные упражнения тоже участвуют в проверке дубликатов', async () => {
    const ports = setup()
    ports.state.exercises.push({ id: id('e-old'), name: 'Планка', archivedAt: NOW, ...stamps })
    await expect(createExercise(ports)({ name: 'Планка' })).rejects.toMatchObject({
      code: 'name-duplicate',
    })
  })

  it('отклонённое создание ничего не пишет в базу', async () => {
    const ports = setup()
    withExercises(ports)
    // сначала удачное создание, чтобы тест не проходил на «ничего не работает»
    await createExercise(ports)({ name: 'Планка' })
    await createExercise(ports)({ name: 'Жим лёжа' }).catch(() => undefined)

    expect(ports.state.exercises.map((e) => e.name)).toEqual([
      'Жим лёжа',
      'Приседания со штангой',
      'Планка',
    ])
  })

  it('проставляет время создания и изменения по часам', async () => {
    const ports = setup()
    const exerciseId = await createExercise(ports)({ name: 'Планка' })
    const created = await ports.exercises.byId(exerciseId)
    expect(created!.createdAt).toBe(NOW)
    expect(created!.updatedAt).toBe(NOW)
  })
})

describe('removeExercise (FR-2.4)', () => {
  it('неиспользованное упражнение удаляется по-настоящему', async () => {
    const ports = setup()
    withExercises(ports)
    await expect(removeExercise(ports)(id('e-1'))).resolves.toBe('deleted')
    expect(ports.state.exercises.map((e) => e.id)).toEqual(['e-2'])
  })

  it('использованное в тренировке только архивируется', async () => {
    const ports = setup()
    withExercises(ports)
    ports.state.programs.push({ id: id('p-1'), name: 'Грудь + трицепс', color: 'prog-red', ...stamps })
    ports.state.programItems.push({ id: id('pi-1'), programId: id('p-1'), exerciseId: id('e-1'), order: 0 })
    await createWorkout(ports)({ date: localDate('2026-08-11'), programId: id('p-1') })

    await expect(removeExercise(ports)(id('e-1'))).resolves.toBe('archived')
    expect((await ports.exercises.byId(id('e-1')))!.archivedAt).toBe(NOW)
  })

  it('архивное упражнение пропадает из обычного списка, но история цела', async () => {
    const ports = setup()
    withExercises(ports)
    ports.state.programs.push({ id: id('p-1'), name: 'Грудь + трицепс', color: 'prog-red', ...stamps })
    ports.state.programItems.push({ id: id('pi-1'), programId: id('p-1'), exerciseId: id('e-1'), order: 0 })
    const workoutId = await createWorkout(ports)({ date: localDate('2026-08-11'), programId: id('p-1') })

    await removeExercise(ports)(id('e-1'))

    expect((await ports.exercises.list()).map((e) => e.id)).toEqual(['e-2'])
    expect((await ports.workouts.byId(workoutId))!.items[0]!.exerciseName).toBe('Жим лёжа')
  })
})

describe('suggestProgramColor (FR-3.1.1)', () => {
  it('на пустой базе предлагает первый цвет палитры', async () => {
    const ports = setup()
    await expect(suggestProgramColor(ports)()).resolves.toBe('prog-red')
  })

  it('пропускает занятые цвета', async () => {
    const ports = setup()
    ports.state.programs.push(
      { id: id('p-1'), name: 'Грудь + трицепс', color: 'prog-red', ...stamps },
      { id: id('p-2'), name: 'Спина + бицепс', color: 'prog-blue', ...stamps },
    )
    await expect(suggestProgramColor(ports)()).resolves.toBe('prog-orange')
  })

  it('цвет архивной программы считается свободным', async () => {
    const ports = setup()
    ports.state.programs.push({
      id: id('p-1'),
      name: 'Старая',
      color: 'prog-red',
      archivedAt: NOW,
      ...stamps,
    })
    await expect(suggestProgramColor(ports)()).resolves.toBe('prog-red')
  })

  it('когда заняты все восемь — цвета начинают повторяться с начала (§7.3)', async () => {
    const ports = setup()
    const palette = [
      'prog-red', 'prog-orange', 'prog-amber', 'prog-green',
      'prog-teal', 'prog-blue', 'prog-violet', 'prog-pink',
    ]
    palette.forEach((color, i) =>
      ports.state.programs.push({ id: id(`p-${i}`), name: `Программа ${i}`, color, ...stamps }),
    )
    await expect(suggestProgramColor(ports)()).resolves.toBe('prog-red')
  })
})

describe('createProgram', () => {
  it('создаёт программу с составом в заданном порядке', async () => {
    const ports = setup()
    withExercises(ports)
    const programId = await createProgram(ports)({
      name: 'Грудь + трицепс',
      exerciseIds: [id('e-2'), id('e-1')],
    })
    const created = await ports.programs.byIdWithItems(programId)
    expect(created!.items.map((i) => i.exerciseId)).toEqual(['e-2', 'e-1'])
    expect(created!.items.map((i) => i.order)).toEqual([0, 1])
  })

  it('без указания цвета берётся первый свободный', async () => {
    const ports = setup()
    ports.state.programs.push({ id: id('p-1'), name: 'Занятая', color: 'prog-red', ...stamps })
    const programId = await createProgram(ports)({ name: 'Новая' })
    expect((await ports.programs.byId(programId))!.color).toBe('prog-orange')
  })

  it('пустое название отклоняется — кнопка создания неактивна (FR-3.1.1)', async () => {
    const ports = setup()
    await expect(createProgram(ports)({ name: '  ' })).rejects.toMatchObject({ code: 'name-empty' })
  })

  it('одинаковые названия программ разрешены', async () => {
    const ports = setup()
    await createProgram(ports)({ name: 'Ноги + пресс' })
    await expect(createProgram(ports)({ name: 'Ноги + пресс' })).resolves.toBeDefined()
  })

  it('программа без упражнений допустима (FR-3.2)', async () => {
    const ports = setup()
    const programId = await createProgram(ports)({ name: 'Свободная' })
    expect((await ports.programs.byIdWithItems(programId))!.items).toHaveLength(0)
  })

  it('одно упражнение дважды в составе отклоняется (FR-3.3)', async () => {
    const ports = setup()
    withExercises(ports)
    await expect(
      createProgram(ports)({ name: 'Кривая', exerciseIds: [id('e-1'), id('e-1')] }),
    ).rejects.toMatchObject({ code: 'exercise-duplicate-in-program' })
  })
})

describe('duplicateProgram (FR-3.6)', () => {
  const seeded = async () => {
    const ports = setup()
    withExercises(ports)
    const programId = await createProgram(ports)({
      name: 'Грудь + трицепс',
      exerciseIds: [id('e-1'), id('e-2')],
    })
    return { ports, programId }
  }

  it('к названию добавляется «(копия)»', async () => {
    const { ports, programId } = await seeded()
    const copyId = await duplicateProgram(ports)(programId)
    expect((await ports.programs.byId(copyId))!.name).toBe('Грудь + трицепс (копия)')
  })

  it('состав копируется с сохранением порядка', async () => {
    const { ports, programId } = await seeded()
    const copyId = await duplicateProgram(ports)(programId)
    const copy = await ports.programs.byIdWithItems(copyId)
    expect(copy!.items.map((i) => i.exerciseId)).toEqual(['e-1', 'e-2'])
  })

  it('копия получает новые идентификаторы, а не ссылается на чужие строки', async () => {
    const { ports, programId } = await seeded()
    const copyId = await duplicateProgram(ports)(programId)
    const original = await ports.programs.byIdWithItems(programId)
    const copy = await ports.programs.byIdWithItems(copyId)
    expect(copyId).not.toBe(programId)
    expect(copy!.items.map((i) => i.id)).not.toEqual(original!.items.map((i) => i.id))
  })

  it('копия получает свободный цвет, а не цвет оригинала', async () => {
    const { ports, programId } = await seeded()
    const copyId = await duplicateProgram(ports)(programId)
    expect((await ports.programs.byId(copyId))!.color).not.toBe(
      (await ports.programs.byId(programId))!.color,
    )
  })

  it('изменение копии не задевает оригинал', async () => {
    const { ports, programId } = await seeded()
    const copyId = await duplicateProgram(ports)(programId)
    await setProgramItems(ports)({ programId: copyId, exerciseIds: [id('e-2')] })
    expect((await ports.programs.byIdWithItems(programId))!.items).toHaveLength(2)
  })
})

describe('setProgramItems', () => {
  it('полностью заменяет состав и перенумеровывает порядок', async () => {
    const ports = setup()
    withExercises(ports)
    const programId = await createProgram(ports)({ name: 'Грудь', exerciseIds: [id('e-1'), id('e-2')] })
    await setProgramItems(ports)({ programId, exerciseIds: [id('e-2')] })

    const items = (await ports.programs.byIdWithItems(programId))!.items
    expect(items.map((i) => i.exerciseId)).toEqual(['e-2'])
    expect(items.map((i) => i.order)).toEqual([0])
  })

  it('изменение состава не задевает уже проведённые тренировки (FR-3.5)', async () => {
    const ports = setup()
    withExercises(ports)
    const programId = await createProgram(ports)({ name: 'Грудь', exerciseIds: [id('e-1'), id('e-2')] })
    const workoutId = await createWorkout(ports)({ date: localDate('2026-08-11'), programId })

    await setProgramItems(ports)({ programId, exerciseIds: [] })

    expect((await ports.workouts.byId(workoutId))!.items).toHaveLength(2)
  })

  it('дубликат в новом составе отклоняется', async () => {
    const ports = setup()
    withExercises(ports)
    const programId = await createProgram(ports)({ name: 'Грудь' })
    await expect(
      setProgramItems(ports)({ programId, exerciseIds: [id('e-1'), id('e-1')] }),
    ).rejects.toMatchObject({ code: 'exercise-duplicate-in-program' })
  })
})

describe('renameProgram (FR-3.1.3)', () => {
  it('меняет название и отмечает правку', async () => {
    const ports = setup()
    const programId = await createProgram(ports)({ name: 'Грудь' })
    ports.clock.advance(60_000)

    await renameProgram(ports)({ programId, name: '  Грудь + трицепс  ' })

    const program = (await ports.programs.byId(programId))!
    expect(program.name).toBe('Грудь + трицепс')
    expect(program.updatedAt).toBe(ports.clock.now())
  })

  it('проведённая тренировка держит прежнее название (FR-3.5)', async () => {
    const ports = setup()
    withExercises(ports)
    const programId = await createProgram(ports)({ name: 'Грудь', exerciseIds: [id('e-1')] })
    const workoutId = await createWorkout(ports)({ date: localDate('2026-08-11'), programId })

    await renameProgram(ports)({ programId, name: 'День А' })

    expect((await ports.workouts.byId(workoutId))!.workout.programName).toBe('Грудь')
  })

  it('пустое название отклоняется', async () => {
    const ports = setup()
    const programId = await createProgram(ports)({ name: 'Грудь' })

    await expect(renameProgram(ports)({ programId, name: '   ' })).rejects.toMatchObject({
      code: 'name-empty',
    })
    expect((await ports.programs.byId(programId))!.name).toBe('Грудь')
  })

  it('несуществующая программа — NotFound', async () => {
    const ports = setup()
    await expect(
      renameProgram(ports)({ programId: id('нет-такой'), name: 'День А' }),
    ).rejects.toMatchObject({ name: 'NotFound' })
  })
})

describe('archiveProgram', () => {
  it('программа пропадает из списка, но остаётся в базе', async () => {
    const ports = setup()
    const programId = await createProgram(ports)({ name: 'Грудь' })
    await archiveProgram(ports)(programId)

    expect(await ports.programs.list()).toHaveLength(0)
    expect(await ports.programs.byId(programId)).not.toBeNull()
  })

  it('тренировки по архивной программе остаются на месте', async () => {
    const ports = setup()
    withExercises(ports)
    const programId = await createProgram(ports)({ name: 'Грудь', exerciseIds: [id('e-1')] })
    const workoutId = await createWorkout(ports)({ date: localDate('2026-08-11'), programId })

    await archiveProgram(ports)(programId)

    expect(await ports.workouts.byId(workoutId)).not.toBeNull()
  })
})
