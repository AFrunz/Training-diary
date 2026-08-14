import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Любая запись должна идти через `useMutation`.
 *
 * Кэш запросов живёт вечно — данные локальные, перезапрашивать их по таймеру
 * незачем. Сбрасывает его общий обработчик `mutationCache.onSuccess`, который
 * срабатывает только на мутациях. Прямой вызов сценария из обработчика нажатия
 * запись сделает, но остальные экраны о ней не узнают: так дважды пропадали
 * созданная программа и новая тренировка.
 */

const UI_ROOT = join(__dirname, '..')

/** Сценарии, меняющие данные. Чтение (`monthStats`, `exportAll`) сюда не входит. */
const WRITES = [
  'createWorkout',
  'addSet',
  'toggleItemDone',
  'addAdHocExercise',
  'editWorkoutTimes',
  'deleteWorkout',
  'createExercise',
  'removeExercise',
  'createProgram',
  'duplicateProgram',
  'setProgramItems',
  'archiveProgram',
  'createAbsence',
  'deleteAbsence',
  'importAll',
  'importFromFile',
  'wipeAllData',
  'runBackup',
  'restoreBackup',
] as const

const screenFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : screenFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })

describe('запись данных', () => {
  const files = screenFiles(UI_ROOT).map((path) => ({
    name: path.slice(UI_ROOT.length + 1),
    source: readFileSync(path, 'utf8'),
  }))

  it('сценарии записи вызываются только из мутаций', () => {
    const offenders = files
      .filter(({ source }) => WRITES.some((useCase) => source.includes(`services.${useCase}(`)))
      .filter(({ source }) => !source.includes('useMutation'))
      .map(({ name }) => name)

    expect(offenders).toEqual([])
  })

  it('точечная инвалидация по ключу больше не нужна: кэш сбрасывается целиком', () => {
    const offenders = files
      .filter(({ source }) => /invalidateQueries\(\s*\{\s*queryKey/.test(source))
      .map(({ name }) => name)

    expect(offenders).toEqual([])
  })
})
