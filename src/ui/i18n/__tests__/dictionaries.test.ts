import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { en, plurals, ru } from '../dictionaries'

describe('словари', () => {
  it('английский покрывает все ключи русского', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort())
  })

  it('нет пустых строк', () => {
    for (const [key, value] of [...Object.entries(ru), ...Object.entries(en)]) {
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('в английском словаре нет кириллицы — забытых переводов', () => {
    const forgotten = Object.entries(en).filter(([, value]) => /[а-яё]/i.test(value))
    expect(forgotten).toEqual([])
  })

  it('подстановки совпадают в обоих языках', () => {
    const placeholders = (value: string) => (value.match(/\{[a-z]+\}/gi) ?? []).sort()
    for (const key of Object.keys(ru) as (keyof typeof ru)[]) {
      expect(placeholders(en[key])).toEqual(placeholders(ru[key]))
    }
  })

  it('для каждого счётного слова заданы формы обоих языков', () => {
    for (const [word, forms] of Object.entries(plurals)) {
      expect(forms.ru.one).toBeTruthy()
      expect(forms.ru.many).toBeTruthy()
      expect(forms.en.other).toBeTruthy()
      expect(word).toBeTruthy()
    }
  })
})

describe('в компонентах нет захардкоженных строк', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : walk(path)
      return path.endsWith('.tsx') ? [path] : []
    })

  /**
   * Правило про текст интерфейса. Комментарии и сообщения об ошибках для
   * разработчика под него не подпадают: пользователь их не видит.
   */
  const isUiString = (line: string): boolean => {
    const code = line.split('//')[0] ?? ''
    if (/throw new \w*Error\(/.test(code)) return false
    return /['"`][^'"`]*[а-яё][^'"`]*['"`]/i.test(code)
  }

  it('кириллица встречается только в словарях', () => {
    const uiRoot = join(__dirname, '..', '..')
    const offenders = walk(uiRoot)
      .filter((path) => !path.includes('/i18n/'))
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .map((line, index) => ({ path: path.split('/src/')[1], line: index + 1, text: line.trim() }))
          .filter(({ text }) => isUiString(text)),
      )

    expect(offenders).toEqual([])
  })
})
