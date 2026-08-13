import { PRESET_EXERCISES } from '../../domain/model/presetExercises'
import type { Exercise } from '../../domain/model/entities'
import type { Ports } from '../ports'

/**
 * Заполнение справочника базовым набором при первом запуске: без него человеку
 * пришлось бы заводить сорок упражнений руками, прежде чем собрать программу.
 *
 * Срабатывает только на пустой базе — ни после удаления упражнений, ни после
 * импорта чужого файла набор не возвращается: это была бы навязчивость.
 */
export const seedPresetExercises =
  (p: Ports) =>
  async (language: 'ru' | 'en'): Promise<number> => {
    const existing = await p.exercises.list({ includeArchived: true })
    if (existing.length > 0) return 0

    const now = p.clock.now()
    const exercises: Exercise[] = PRESET_EXERCISES.map((preset) => ({
      id: p.ids.uuid(),
      name: language === 'ru' ? preset.ru : preset.en,
      muscleGroup: preset.muscleGroup,
      note: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }))

    await p.uow.tx(async () => {
      for (const exercise of exercises) {
        await p.exercises.insert(exercise)
      }
    })

    return exercises.length
  }
