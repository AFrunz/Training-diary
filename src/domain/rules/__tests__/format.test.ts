import { instant } from '../../model/types'
import {
  EMPTY_VALUE,
  formatCompletion,
  formatDuration,
  formatElapsed,
  formatSet,
  formatWeight,
} from '../format'

const min = (n: number) => n * 60 * 1000
const hour = (n: number) => n * 60 * 60 * 1000

describe('formatDuration', () => {
  it('меньше часа — только минуты, как на карточке «47 мин»', () => {
    expect(formatDuration(min(47), 'ru')).toBe('47 мин')
  })

  it('с часами минуты дополняются нулём, как на макете «1 ч 08 мин»', () => {
    expect(formatDuration(hour(1) + min(8), 'ru')).toBe('1 ч 08 мин')
    expect(formatDuration(hour(1) + min(12), 'ru')).toBe('1 ч 12 мин')
  })

  it('ровный час показывается с нулевыми минутами, а не «1 ч»', () => {
    expect(formatDuration(hour(1), 'ru')).toBe('1 ч 00 мин')
  })

  it('секунды отбрасываются вниз, а не округляются вверх', () => {
    expect(formatDuration(min(59) + 59_000, 'ru')).toBe('59 мин')
  })

  it('ноль — это «0 мин», а не пустая строка', () => {
    expect(formatDuration(0, 'ru')).toBe('0 мин')
  })

  it('меньше минуты — «0 мин»', () => {
    expect(formatDuration(30_000, 'ru')).toBe('0 мин')
  })

  it('нет данных — прочерк (FR-6.4)', () => {
    expect(formatDuration(null, 'ru')).toBe(EMPTY_VALUE)
  })

  it('длительность больше суток не ломает формат', () => {
    expect(formatDuration(hour(26) + min(5), 'ru')).toBe('26 ч 05 мин')
  })

  it('английский формат', () => {
    expect(formatDuration(min(47), 'en')).toBe('47 min')
    expect(formatDuration(hour(1) + min(8), 'en')).toBe('1 h 08 min')
  })
})

describe('formatElapsed — счётчик идущей тренировки (FR-4.3)', () => {
  const started = instant(Date.parse('2026-08-11T15:32:00Z'))

  it('через 72 минуты показывает «1 ч 12 мин»', () => {
    expect(formatElapsed(started, started + min(72), 'ru')).toBe('1 ч 12 мин')
  })

  it('в самом начале показывает «0 мин», а не прочерк', () => {
    expect(formatElapsed(started, started, 'ru')).toBe('0 мин')
  })

  it('часы на устройстве отстали — отрицательное время показывается нулём', () => {
    expect(formatElapsed(started, started - min(5), 'ru')).toBe('0 мин')
  })
})

describe('formatSet', () => {
  it('вес и повторы через знак умножения', () => {
    expect(formatSet({ weightKg: 80, reps: 8 }, 'kg', 'ru')).toBe('80 × 8')
  })

  it('дробный вес пишется через точку, как в макетах', () => {
    expect(formatSet({ weightKg: 82.5, reps: 6 }, 'kg', 'ru')).toBe('82.5 × 6')
  })

  it('целый вес показывается без лишних нулей', () => {
    expect(formatSet({ weightKg: 80.0, reps: 8 }, 'kg', 'ru')).toBe('80 × 8')
  })

  it('упражнение без веса — только повторы', () => {
    expect(formatSet({ weightKg: null, reps: 12 }, 'kg', 'ru')).toBe('× 12')
    expect(formatSet({ reps: 12 }, 'kg', 'ru')).toBe('× 12')
  })

  it('в фунтах вес переводится и округляется до целого', () => {
    expect(formatSet({ weightKg: 82.5, reps: 6 }, 'lb', 'ru')).toBe('182 × 6')
  })

  it('нулевой вес — это вес, он показывается', () => {
    expect(formatSet({ weightKg: 0, reps: 20 }, 'kg', 'ru')).toBe('0 × 20')
  })

  it('своя единица подхода подписывается, совпадающая с настройками — нет (FR-4.11)', () => {
    expect(formatSet({ weightKg: 82.5, unit: 'lb', reps: 6 }, 'kg', 'ru')).toBe('182 lb × 6')
    expect(formatSet({ weightKg: 82.5, unit: 'lb', reps: 6 }, 'lb', 'ru')).toBe('182 × 6')
    expect(formatSet({ weightKg: 82.5, unit: 'kg', reps: 6 }, 'lb', 'ru')).toBe('82.5 кг × 6')
    expect(formatSet({ weightKg: 82.5, unit: 'kg', reps: 6 }, 'lb', 'en')).toBe('82.5 kg × 6')
  })

  it('угол показывается градусами и в фунтах не пересчитывается', () => {
    expect(formatSet({ angleDeg: 45, unit: 'deg', reps: 15 }, 'kg', 'ru')).toBe('45° × 15')
    expect(formatSet({ angleDeg: 45, unit: 'deg', reps: 15 }, 'lb', 'en')).toBe('45° × 15')
  })

  it('подход с единицей deg без угла — только повторы', () => {
    expect(formatSet({ unit: 'deg', reps: 15 }, 'kg', 'ru')).toBe('× 15')
  })
})

describe('formatWeight', () => {
  it('добавляет единицу измерения', () => {
    expect(formatWeight(82.5, 'kg', 'ru')).toBe('82.5 кг')
    expect(formatWeight(82.5, 'lb', 'ru')).toBe('182 lb')
  })

  it('английский вариант', () => {
    expect(formatWeight(82.5, 'kg', 'en')).toBe('82.5 kg')
  })

  it('нет веса — прочерк', () => {
    expect(formatWeight(null, 'kg', 'ru')).toBe(EMPTY_VALUE)
  })
})

describe('formatCompletion', () => {
  it('доля выполненных упражнений', () => {
    expect(formatCompletion(3, 5)).toBe('3/5')
  })

  it('пустая тренировка не превращается в «0/0» с делением на ноль в другом месте', () => {
    expect(formatCompletion(0, 0)).toBe('0/0')
  })
})
