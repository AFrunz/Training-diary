import type { Exercise, Program, Settings, Workout, WorkoutItem, WorkoutSet } from '../../model/entities'
import { id, instant, localDate } from '../../model/types'
import { buildBundle, mergeBundles, parseBundle } from '../bundle'
import { ImportError, SCHEMA_VERSION } from '../types'
import type { ExportBundle } from '../types'

const at = (iso: string) => instant(Date.parse(iso))

const settings: Settings = { unit: 'kg', firstDayOfWeek: 1, theme: 'system', language: 'system' }

const exercise = (over: Partial<Exercise> & Pick<Exercise, 'id' | 'name'>): Exercise => ({
  createdAt: at('2026-01-01T00:00:00Z'),
  updatedAt: at('2026-01-01T00:00:00Z'),
  ...over,
})

const program = (over: Partial<Program> & Pick<Program, 'id' | 'name'>): Program => ({
  color: 'prog-red',
  createdAt: at('2026-01-01T00:00:00Z'),
  updatedAt: at('2026-01-01T00:00:00Z'),
  ...over,
})

const workout = (over: Partial<Workout> & Pick<Workout, 'id' | 'date'>): Workout => ({
  programId: id('p-1'),
  programName: 'Грудь + трицепс',
  programColor: 'prog-red',
  startedAt: at('2026-08-11T15:32:00Z'),
  createdAt: at('2026-08-11T15:32:00Z'),
  updatedAt: at('2026-08-11T15:32:00Z'),
  ...over,
})

const item = (over: Partial<WorkoutItem> & Pick<WorkoutItem, 'id' | 'workoutId'>): WorkoutItem => ({
  exerciseId: id('e-1'),
  exerciseName: 'Жим лёжа',
  order: 0,
  isAdHoc: false,
  ...over,
})

const set = (over: Partial<WorkoutSet> & Pick<WorkoutSet, 'id' | 'workoutItemId'>): WorkoutSet => ({
  order: 0,
  reps: 8,
  weightKg: 80,
  createdAt: at('2026-08-11T15:40:00Z'),
  ...over,
})

const bundle = (over: Partial<ExportBundle> = {}): ExportBundle => ({
  schemaVersion: SCHEMA_VERSION,
  exportedAt: at('2026-08-11T18:00:00Z'),
  exercises: [],
  programs: [],
  programItems: [],
  workouts: [],
  workoutItems: [],
  workoutSets: [],
  absences: [],
  settings,
  ...over,
})

/** Проверяет, что разбор упал именно с ожидаемой причиной, а не с любой ошибкой. */
const expectImportError = (raw: unknown, code: string) => {
  expect(() => parseBundle(raw)).toThrow(ImportError)
  expect(() => parseBundle(raw)).toThrow(expect.objectContaining({ code }))
}

describe('buildBundle', () => {
  it('проставляет версию схемы и время выгрузки', () => {
    const result = buildBundle(
      {
        exercises: [],
        programs: [],
        programItems: [],
        workouts: [],
        workoutItems: [],
        workoutSets: [],
        absences: [],
        settings,
      },
      at('2026-08-11T18:00:00Z'),
    )
    expect(result.schemaVersion).toBe(SCHEMA_VERSION)
    expect(result.exportedAt).toBe(at('2026-08-11T18:00:00Z'))
  })
})

describe('parseBundle', () => {
  it('разбирает корректный файл', () => {
    const raw = JSON.parse(JSON.stringify(bundle({ exercises: [exercise({ id: id('e-1'), name: 'Жим лёжа' })] })))
    expect(parseBundle(raw).exercises).toHaveLength(1)
  })

  it('пустая база — тоже корректный файл', () => {
    expect(() => parseBundle(JSON.parse(JSON.stringify(bundle())))).not.toThrow()
  })

  it.each([[null], [undefined], ['строка'], [42], [[]]])('%p не является файлом выгрузки', (raw) => {
    expectImportError(raw, 'not-an-object')
  })

  it('версия схемы из будущего отклоняется с внятной причиной (FR-7.2)', () => {
    expectImportError({ ...bundle(), schemaVersion: SCHEMA_VERSION + 1 }, 'unsupported-schema-version')
  })

  it('файл без версии схемы отклоняется', () => {
    const { schemaVersion, ...withoutVersion } = bundle()
    expectImportError(withoutVersion, 'unsupported-schema-version')
  })

  it('пропущенная коллекция отклоняется, а не превращается в пустую', () => {
    const { workouts, ...withoutWorkouts } = bundle()
    expectImportError(withoutWorkouts, 'missing-collection')
  })

  it('повторяющиеся идентификаторы внутри файла — испорченный файл', () => {
    expectImportError(
      bundle({
        exercises: [exercise({ id: id('e-1'), name: 'Жим лёжа' }), exercise({ id: id('e-1'), name: 'Другое' })],
      }),
      'duplicate-ids',
    )
  })

  it('запись без обязательного поля отклоняется', () => {
    expectImportError(bundle({ workouts: [{ id: 'w-1' } as unknown as Workout] }), 'invalid-record')
  })

  it('незнакомые поля не мешают: файл новой минорной версии должен открываться', () => {
    const raw = { ...bundle(), somethingNew: true }
    expect(() => parseBundle(raw)).not.toThrow()
  })
})

describe('mergeBundles — режим «Заменить всё»', () => {
  const current = bundle({ exercises: [exercise({ id: id('e-1'), name: 'Жим лёжа' })] })
  const incoming = bundle({
    exercises: [exercise({ id: id('e-2'), name: 'Приседания' })],
    settings: { ...settings, unit: 'lb' },
  })

  it('текущие данные полностью вытесняются', () => {
    const { bundle: result } = mergeBundles(current, incoming, 'replace')
    expect(result.exercises.map((e) => e.id)).toEqual(['e-2'])
  })

  it('настройки тоже приезжают из файла', () => {
    const { bundle: result } = mergeBundles(current, incoming, 'replace')
    expect(result.settings.unit).toBe('lb')
  })
})

describe('mergeBundles — режим «Дополнить»', () => {
  it('новые записи добавляются', () => {
    const current = bundle({ exercises: [exercise({ id: id('e-1'), name: 'Жим лёжа' })] })
    const incoming = bundle({ exercises: [exercise({ id: id('e-2'), name: 'Приседания' })] })
    const { bundle: result, summary } = mergeBundles(current, incoming, 'merge')
    expect(result.exercises.map((e) => e.id).sort()).toEqual(['e-1', 'e-2'])
    expect(summary.added).toBe(1)
  })

  it('при совпадении id побеждает запись со свежим updatedAt', () => {
    const current = bundle({
      exercises: [exercise({ id: id('e-1'), name: 'Старое', updatedAt: at('2026-08-01T00:00:00Z') })],
    })
    const incoming = bundle({
      exercises: [exercise({ id: id('e-1'), name: 'Новое', updatedAt: at('2026-08-10T00:00:00Z') })],
    })
    const { bundle: result, summary } = mergeBundles(current, incoming, 'merge')
    expect(result.exercises[0]!.name).toBe('Новое')
    expect(summary.updated).toBe(1)
  })

  it('устаревшая запись из файла не затирает текущую', () => {
    const current = bundle({
      exercises: [exercise({ id: id('e-1'), name: 'Текущее', updatedAt: at('2026-08-10T00:00:00Z') })],
    })
    const incoming = bundle({
      exercises: [exercise({ id: id('e-1'), name: 'Старое', updatedAt: at('2026-08-01T00:00:00Z') })],
    })
    const { bundle: result, summary } = mergeBundles(current, incoming, 'merge')
    expect(result.exercises[0]!.name).toBe('Текущее')
    expect(summary.skipped).toBe(1)
  })

  it('при равном updatedAt остаётся текущая запись', () => {
    const same = at('2026-08-10T00:00:00Z')
    const current = bundle({ exercises: [exercise({ id: id('e-1'), name: 'Текущее', updatedAt: same })] })
    const incoming = bundle({ exercises: [exercise({ id: id('e-1'), name: 'Из файла', updatedAt: same })] })
    const { bundle: result } = mergeBundles(current, incoming, 'merge')
    expect(result.exercises[0]!.name).toBe('Текущее')
  })

  it('настройки устройства при дополнении не трогаются', () => {
    const current = bundle({ settings: { ...settings, unit: 'kg' } })
    const incoming = bundle({ settings: { ...settings, unit: 'lb' } })
    const { bundle: result } = mergeBundles(current, incoming, 'merge')
    expect(result.settings.unit).toBe('kg')
  })

  it('повторный импорт того же файла ничего не меняет', () => {
    const current = bundle({ exercises: [exercise({ id: id('e-1'), name: 'Жим лёжа' })] })
    const incoming = bundle({ exercises: [exercise({ id: id('e-2'), name: 'Приседания' })] })
    const once = mergeBundles(current, incoming, 'merge').bundle
    const twice = mergeBundles(once, incoming, 'merge')
    expect(twice.bundle.exercises).toHaveLength(2)
    expect(twice.summary.added).toBe(0)
  })
})

describe('mergeBundles — дочерние записи едут вместе с родителем', () => {
  const w = id('w-1')

  const current = bundle({
    workouts: [workout({ id: w, date: localDate('2026-08-11'), updatedAt: at('2026-08-11T18:00:00Z') })],
    workoutItems: [item({ id: id('wi-1'), workoutId: w })],
    workoutSets: [set({ id: id('ws-1'), workoutItemId: id('wi-1'), reps: 8 })],
  })

  const incoming = bundle({
    workouts: [workout({ id: w, date: localDate('2026-08-11'), updatedAt: at('2026-08-12T09:00:00Z') })],
    workoutItems: [item({ id: id('wi-2'), workoutId: w, exerciseName: 'Жим гантелей' })],
    workoutSets: [set({ id: id('ws-2'), workoutItemId: id('wi-2'), reps: 10 })],
  })

  it('победивший в конфликте родитель приводит свои упражнения и подходы', () => {
    const { bundle: result } = mergeBundles(current, incoming, 'merge')
    expect(result.workoutItems.map((i) => i.id)).toEqual(['wi-2'])
    expect(result.workoutSets.map((s) => s.id)).toEqual(['ws-2'])
  })

  it('проигравший родитель не оставляет после себя осиротевших детей', () => {
    const { bundle: result } = mergeBundles(incoming, current, 'merge')
    expect(result.workoutItems.map((i) => i.id)).toEqual(['wi-2'])
    expect(result.workoutSets.every((s) => s.workoutItemId === 'wi-2')).toBe(true)
  })

  it('дети без родителя в файле отбрасываются', () => {
    const orphan = bundle({ workoutItems: [item({ id: id('wi-9'), workoutId: id('w-нет') })] })
    const { bundle: result } = mergeBundles(bundle(), orphan, 'merge')
    expect(result.workoutItems).toHaveLength(0)
  })
})

describe('mergeBundles — одна тренировка на дату (FR-1.3)', () => {
  it('две разные тренировки на одну дату: остаётся более свежая', () => {
    const current = bundle({
      workouts: [workout({ id: id('w-old'), date: localDate('2026-08-11'), updatedAt: at('2026-08-11T18:00:00Z') })],
    })
    const incoming = bundle({
      workouts: [workout({ id: id('w-new'), date: localDate('2026-08-11'), updatedAt: at('2026-08-12T10:00:00Z') })],
    })
    const { bundle: result, summary } = mergeBundles(current, incoming, 'merge')
    expect(result.workouts.map((w) => w.id)).toEqual(['w-new'])
    expect(summary.droppedByDateConflict).toBe(1)
  })

  it('если свежее текущая — приезжая тренировка отбрасывается', () => {
    const current = bundle({
      workouts: [workout({ id: id('w-old'), date: localDate('2026-08-11'), updatedAt: at('2026-08-12T10:00:00Z') })],
    })
    const incoming = bundle({
      workouts: [workout({ id: id('w-new'), date: localDate('2026-08-11'), updatedAt: at('2026-08-11T18:00:00Z') })],
    })
    const { bundle: result, summary } = mergeBundles(current, incoming, 'merge')
    expect(result.workouts.map((w) => w.id)).toEqual(['w-old'])
    expect(summary.droppedByDateConflict).toBe(1)
  })

  it('отброшенная по дате тренировка не оставляет своих упражнений', () => {
    const current = bundle({
      workouts: [workout({ id: id('w-old'), date: localDate('2026-08-11'), updatedAt: at('2026-08-11T18:00:00Z') })],
      workoutItems: [item({ id: id('wi-old'), workoutId: id('w-old') })],
    })
    const incoming = bundle({
      workouts: [workout({ id: id('w-new'), date: localDate('2026-08-11'), updatedAt: at('2026-08-12T10:00:00Z') })],
      workoutItems: [item({ id: id('wi-new'), workoutId: id('w-new') })],
    })
    const { bundle: result } = mergeBundles(current, incoming, 'merge')
    expect(result.workoutItems.map((i) => i.id)).toEqual(['wi-new'])
  })

  it('тренировки на разные даты не конфликтуют', () => {
    const current = bundle({ workouts: [workout({ id: id('w-1'), date: localDate('2026-08-11') })] })
    const incoming = bundle({ workouts: [workout({ id: id('w-2'), date: localDate('2026-08-12') })] })
    const { bundle: result, summary } = mergeBundles(current, incoming, 'merge')
    expect(result.workouts).toHaveLength(2)
    expect(summary.droppedByDateConflict).toBe(0)
  })
})

describe('mergeBundles — целостность ссылок', () => {
  it('тренировка импортируется, даже если упражнения из справочника нет: названия сохранены снапшотом (FR-3.5)', () => {
    const incoming = bundle({
      workouts: [workout({ id: id('w-1'), date: localDate('2026-08-11') })],
      workoutItems: [item({ id: id('wi-1'), workoutId: id('w-1'), exerciseId: id('e-удалено') })],
    })
    const { bundle: result } = mergeBundles(bundle(), incoming, 'merge')
    expect(result.workouts).toHaveLength(1)
    expect(result.workoutItems[0]!.exerciseName).toBe('Жим лёжа')
  })

  it('состав программы приезжает вместе с программой', () => {
    const incoming = bundle({
      programs: [program({ id: id('p-1'), name: 'Грудь + трицепс' })],
      programItems: [{ id: id('pi-1'), programId: id('p-1'), exerciseId: id('e-1'), order: 0 }],
    })
    const { bundle: result } = mergeBundles(bundle(), incoming, 'merge')
    expect(result.programItems).toHaveLength(1)
  })
})
