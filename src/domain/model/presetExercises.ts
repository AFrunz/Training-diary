/**
 * Базовый набор упражнений, которым заполняется пустая база при первом запуске.
 *
 * Это данные, а не строки интерфейса: заведённое упражнение принадлежит
 * пользователю и при смене языка не переводится (FR-7.6). Поэтому названия
 * лежат парой и выбираются один раз — в момент заполнения.
 */

export type MuscleGroupKey = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'

export interface PresetExercise {
  readonly muscleGroup: MuscleGroupKey
  readonly ru: string
  readonly en: string
}

export const PRESET_EXERCISES: readonly PresetExercise[] = [
  { muscleGroup: 'chest', ru: 'Жим штанги лёжа', en: 'Barbell bench press' },
  { muscleGroup: 'chest', ru: 'Жим гантелей лёжа', en: 'Dumbbell bench press' },
  { muscleGroup: 'chest', ru: 'Жим гантелей на наклонной скамье', en: 'Incline dumbbell press' },
  { muscleGroup: 'chest', ru: 'Жим в тренажёре сидя', en: 'Seated chest press' },
  { muscleGroup: 'chest', ru: 'Разводка гантелей лёжа', en: 'Dumbbell fly' },
  { muscleGroup: 'chest', ru: 'Сведения в кроссовере', en: 'Cable crossover' },
  { muscleGroup: 'chest', ru: 'Отжимания на брусьях', en: 'Chest dips' },
  { muscleGroup: 'chest', ru: 'Отжимания от пола', en: 'Push-ups' },

  { muscleGroup: 'back', ru: 'Подтягивания', en: 'Pull-ups' },
  { muscleGroup: 'back', ru: 'Тяга верхнего блока к груди', en: 'Lat pulldown' },
  { muscleGroup: 'back', ru: 'Тяга горизонтального блока', en: 'Seated cable row' },
  { muscleGroup: 'back', ru: 'Тяга штанги в наклоне', en: 'Bent-over barbell row' },
  { muscleGroup: 'back', ru: 'Тяга гантели одной рукой', en: 'One-arm dumbbell row' },
  { muscleGroup: 'back', ru: 'Становая тяга', en: 'Deadlift' },
  { muscleGroup: 'back', ru: 'Гиперэкстензия', en: 'Back extension' },
  { muscleGroup: 'back', ru: 'Шраги с гантелями', en: 'Dumbbell shrugs' },

  { muscleGroup: 'legs', ru: 'Приседания со штангой', en: 'Barbell squat' },
  { muscleGroup: 'legs', ru: 'Фронтальные приседания', en: 'Front squat' },
  { muscleGroup: 'legs', ru: 'Жим ногами', en: 'Leg press' },
  { muscleGroup: 'legs', ru: 'Румынская тяга', en: 'Romanian deadlift' },
  { muscleGroup: 'legs', ru: 'Выпады с гантелями', en: 'Dumbbell lunges' },
  { muscleGroup: 'legs', ru: 'Болгарские выпады', en: 'Bulgarian split squat' },
  { muscleGroup: 'legs', ru: 'Разгибания ног в тренажёре', en: 'Leg extension' },
  { muscleGroup: 'legs', ru: 'Сгибания ног лёжа', en: 'Lying leg curl' },
  { muscleGroup: 'legs', ru: 'Подъёмы на носки стоя', en: 'Standing calf raise' },
  { muscleGroup: 'legs', ru: 'Ягодичный мостик', en: 'Hip thrust' },

  { muscleGroup: 'shoulders', ru: 'Жим штанги стоя', en: 'Overhead barbell press' },
  { muscleGroup: 'shoulders', ru: 'Жим гантелей сидя', en: 'Seated dumbbell press' },
  { muscleGroup: 'shoulders', ru: 'Махи гантелями в стороны', en: 'Lateral raise' },
  { muscleGroup: 'shoulders', ru: 'Махи в наклоне', en: 'Bent-over lateral raise' },
  { muscleGroup: 'shoulders', ru: 'Тяга штанги к подбородку', en: 'Upright row' },
  { muscleGroup: 'shoulders', ru: 'Разведения в тренажёре на задние дельты', en: 'Reverse pec deck' },

  { muscleGroup: 'arms', ru: 'Подъём штанги на бицепс', en: 'Barbell curl' },
  { muscleGroup: 'arms', ru: 'Подъём гантелей на бицепс', en: 'Dumbbell curl' },
  { muscleGroup: 'arms', ru: 'Молотки', en: 'Hammer curl' },
  { muscleGroup: 'arms', ru: 'Французский жим', en: 'Skull crusher' },
  { muscleGroup: 'arms', ru: 'Разгибания на блоке', en: 'Triceps pushdown' },
  { muscleGroup: 'arms', ru: 'Отжимания узким хватом', en: 'Close-grip push-ups' },

  { muscleGroup: 'core', ru: 'Скручивания', en: 'Crunches' },
  { muscleGroup: 'core', ru: 'Планка', en: 'Plank' },
]
