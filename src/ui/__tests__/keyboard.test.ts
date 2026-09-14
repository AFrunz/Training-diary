import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Любой экран с полем ввода поднимается над клавиатурой.
 *
 * С edge-to-edge (по умолчанию с Expo SDK 53) окно под клавиатуру не сжимается,
 * поэтому `adjustResize` ничего не делает: поле и кнопки остаются под ней. Так
 * уже прятались ввод в шите подхода и поиск в выборе упражнений. Лечится это
 * одним компонентом `KeyboardAvoider` — тест следит, чтобы про него не забыли.
 */

const UI_ROOT = join(__dirname, '..')

/**
 * Экраны, где поле ввода стоит в шапке и под ним ничего не прячется: список
 * под поиском можно и нужно перекрывать клавиатурой, он прокручивается.
 */
const HEADER_SEARCH_ONLY = ['screens/library/LibraryScreen.tsx']

const screenFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : screenFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })

describe('ввод и клавиатура', () => {
  const files = screenFiles(UI_ROOT)
    .map((path) => ({ name: path.slice(UI_ROOT.length + 1), source: readFileSync(path, 'utf8') }))
    .filter(({ name }) => name !== 'components/KeyboardAvoider.tsx')

  it('экраны с полем ввода оборачиваются в KeyboardAvoider', () => {
    const offenders = files
      .filter(({ source }) => source.includes('<TextInput'))
      .filter(({ name }) => !HEADER_SEARCH_ONLY.includes(name))
      .filter(({ source }) => !source.includes('<KeyboardAvoider'))
      .map(({ name }) => name)

    expect(offenders).toEqual([])
  })

  it('KeyboardAvoidingView напрямую не используется: поведение задаётся в одном месте', () => {
    const offenders = files
      .filter(({ source }) => source.includes('KeyboardAvoidingView'))
      .map(({ name }) => name)

    expect(offenders).toEqual([])
  })
})
