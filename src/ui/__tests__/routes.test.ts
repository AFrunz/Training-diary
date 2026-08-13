import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Проверка маршрутов expo-router. Заголовки навигации скрыты, поэтому безопасные
 * зоны разводит контейнер `Screen`: без него шторка наезжает на шапку, а кнопки
 * уезжают под жестовую полосу. Забыть обёртку легко — тест не даёт.
 */

const APP_ROOT = join(__dirname, '..', '..', '..', 'app')

const routeFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return routeFiles(path)
    // раскладки задают навигацию, а не содержимое экрана
    return path.endsWith('.tsx') && !path.endsWith('_layout.tsx') ? [path] : []
  })

const relative = (path: string) => path.slice(APP_ROOT.length + 1)

describe('маршруты', () => {
  const files = routeFiles(APP_ROOT)

  it('их больше десятка: приложение собрано из отдельных экранов', () => {
    expect(files.length).toBeGreaterThanOrEqual(12)
  })

  it('каждый маршрут обёрнут в Screen с безопасными зонами', () => {
    const missing = files.filter((path) => !readFileSync(path, 'utf8').includes('<Screen')).map(relative)
    expect(missing).toEqual([])
  })

  it('обёртка импортируется, а не берётся из воздуха', () => {
    const missing = files
      .filter((path) => !/components\/Screen['"]/.test(readFileSync(path, 'utf8')))
      .map(relative)
    expect(missing).toEqual([])
  })

  it('вкладки не добавляют нижний отступ: его держит таббар', () => {
    const tabs = files.filter((path) => path.includes('(tabs)'))
    const wrong = tabs
      .filter((path) => !readFileSync(path, 'utf8').includes('withBottomInset={false}'))
      .map(relative)

    expect(tabs.length).toBe(5)
    expect(wrong).toEqual([])
  })

  it('экраны поверх стека нижний отступ оставляют: там кнопки у самого низа', () => {
    const stacked = files.filter((path) => !path.includes('(tabs)'))
    const wrong = stacked
      .filter((path) => readFileSync(path, 'utf8').includes('withBottomInset={false}'))
      .map(relative)

    expect(wrong).toEqual([])
  })
})
