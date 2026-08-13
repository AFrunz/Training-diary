import { PRESET_EXERCISES } from '../../../domain/model/presetExercises'
import { instant } from '../../../domain/model/types'
import { createFakePorts } from '../../testing/fakes'
import { createExercise } from '../library'
import { seedPresetExercises } from '../seed'

const NOW = instant(Date.parse('2026-08-11T15:32:00Z'))
const setup = () => createFakePorts({ now: NOW })

describe('seedPresetExercises', () => {
  it('на пустой базе заводит весь набор', async () => {
    const ports = setup()
    const added = await seedPresetExercises(ports)('ru')

    expect(added).toBe(PRESET_EXERCISES.length)
    expect(ports.state.exercises).toHaveLength(PRESET_EXERCISES.length)
  })

  it('названия берутся по языку', async () => {
    const ports = setup()
    await seedPresetExercises(ports)('ru')
    expect(ports.state.exercises.map((exercise) => exercise.name)).toContain('Жим штанги лёжа')

    const english = setup()
    await seedPresetExercises(english)('en')
    expect(english.state.exercises.map((exercise) => exercise.name)).toContain('Barbell bench press')
  })

  it('группы мышц совпадают с разделами библиотеки', async () => {
    const ports = setup()
    await seedPresetExercises(ports)('ru')

    const groups = new Set(ports.state.exercises.map((exercise) => exercise.muscleGroup))
    expect([...groups].sort()).toEqual(['arms', 'back', 'chest', 'core', 'legs', 'shoulders'])
  })

  it('повторный запуск ничего не добавляет', async () => {
    const ports = setup()
    await seedPresetExercises(ports)('ru')
    const added = await seedPresetExercises(ports)('ru')

    expect(added).toBe(0)
    expect(ports.state.exercises).toHaveLength(PRESET_EXERCISES.length)
  })

  it('на непустой базе набор не заводится: справочник уже чей-то', async () => {
    const ports = setup()
    await createExercise(ports)({ name: 'Жим лёжа' })

    const added = await seedPresetExercises(ports)('ru')

    expect(added).toBe(0)
    expect(ports.state.exercises).toHaveLength(1)
  })

  it('архивные упражнения тоже считаются: после удаления набор не возвращается', async () => {
    const ports = setup()
    ports.state.exercises.push({
      id: ports.ids.uuid(),
      name: 'Планка',
      archivedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })

    expect(await seedPresetExercises(ports)('ru')).toBe(0)
  })

  it('время создания берётся из часов', async () => {
    const ports = setup()
    await seedPresetExercises(ports)('ru')

    expect(ports.state.exercises.every((exercise) => exercise.createdAt === NOW)).toBe(true)
  })

  it('идентификаторы уникальны', async () => {
    const ports = setup()
    await seedPresetExercises(ports)('ru')

    const ids = new Set(ports.state.exercises.map((exercise) => exercise.id))
    expect(ids.size).toBe(PRESET_EXERCISES.length)
  })
})

describe('набор упражнений', () => {
  it('в нём сорок упражнений', () => {
    expect(PRESET_EXERCISES).toHaveLength(40)
  })

  it('названия не повторяются ни на одном языке', () => {
    const ru = new Set(PRESET_EXERCISES.map((preset) => preset.ru.toLowerCase()))
    const en = new Set(PRESET_EXERCISES.map((preset) => preset.en.toLowerCase()))

    expect(ru.size).toBe(PRESET_EXERCISES.length)
    expect(en.size).toBe(PRESET_EXERCISES.length)
  })

  it('каждая группа мышц представлена', () => {
    for (const group of ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']) {
      expect(PRESET_EXERCISES.some((preset) => preset.muscleGroup === group)).toBe(true)
    }
  })
})
