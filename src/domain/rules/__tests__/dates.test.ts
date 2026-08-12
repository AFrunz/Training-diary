import { instant, localDate } from '../../model/types'
import {
  addDays,
  daysBetween,
  isSameLocalDay,
  isWithin,
  startOfWeek,
  toLocalDate,
  weekOf,
  weekdayOf,
  weeksOfRange,
} from '../dates'

const MSK = 'Europe/Moscow' // UTC+3 круглый год
const NY = 'America/New_York' // переходит на летнее время
const utc = (iso: string) => instant(Date.parse(iso))

describe('toLocalDate — принадлежность дню считается по локальной дате, а не по UTC', () => {
  it('поздний вечер по Москве уже относится к следующему дню по UTC, но остаётся сегодняшним локально', () => {
    expect(toLocalDate(utc('2026-08-11T20:30:00Z'), MSK)).toBe('2026-08-11')
  })

  it('тот же момент в Нью-Йорке — предыдущий день', () => {
    expect(toLocalDate(utc('2026-08-11T02:30:00Z'), NY)).toBe('2026-08-10')
  })

  it('граница суток: последняя миллисекунда дня и первая следующего', () => {
    expect(toLocalDate(utc('2026-08-11T20:59:59.999Z'), MSK)).toBe('2026-08-11')
    expect(toLocalDate(utc('2026-08-11T21:00:00.000Z'), MSK)).toBe('2026-08-12')
  })

  it('дата дополняется нулями до формата YYYY-MM-DD', () => {
    expect(toLocalDate(utc('2026-01-05T10:00:00Z'), MSK)).toBe('2026-01-05')
  })

  it('переход на летнее время не сдвигает календарную дату', () => {
    // 8 марта 2026 в Нью-Йорке часы прыгают с 01:59 на 03:00
    expect(toLocalDate(utc('2026-03-08T06:45:00Z'), NY)).toBe('2026-03-08')
    expect(toLocalDate(utc('2026-03-08T07:30:00Z'), NY)).toBe('2026-03-08')
  })
})

describe('isSameLocalDay', () => {
  it('два момента внутри одного локального дня', () => {
    expect(isSameLocalDay(utc('2026-08-11T05:00:00Z'), utc('2026-08-11T20:00:00Z'), MSK)).toBe(true)
  })

  it('моменты по разные стороны полуночи — разные дни', () => {
    expect(isSameLocalDay(utc('2026-08-11T20:59:59Z'), utc('2026-08-11T21:00:01Z'), MSK)).toBe(false)
  })

  it('один и тот же момент может быть разными днями в разных зонах', () => {
    const at = utc('2026-08-11T02:30:00Z')
    expect(toLocalDate(at, MSK)).toBe('2026-08-11')
    expect(toLocalDate(at, NY)).toBe('2026-08-10')
  })
})

describe('weekdayOf — нумерация ISO', () => {
  it.each([
    ['2026-08-10', 1], // понедельник
    ['2026-08-11', 2],
    ['2026-08-15', 6],
    ['2026-08-16', 7], // воскресенье
  ])('%s → %i', (date, expected) => {
    expect(weekdayOf(localDate(date))).toBe(expected)
  })
})

describe('startOfWeek', () => {
  it('неделя с понедельника: вторник откатывается к понедельнику', () => {
    expect(startOfWeek(localDate('2026-08-11'), 1)).toBe('2026-08-10')
  })

  it('неделя с понедельника: воскресенье относится к предыдущему понедельнику', () => {
    expect(startOfWeek(localDate('2026-08-16'), 1)).toBe('2026-08-10')
  })

  it('неделя с воскресенья: воскресенье само является началом', () => {
    expect(startOfWeek(localDate('2026-08-16'), 7)).toBe('2026-08-16')
  })

  it('неделя с воскресенья: вторник откатывается к прошлому воскресенью', () => {
    expect(startOfWeek(localDate('2026-08-11'), 7)).toBe('2026-08-09')
  })

  it('начало недели уже является началом недели — идемпотентность', () => {
    const start = startOfWeek(localDate('2026-08-11'), 1)
    expect(startOfWeek(start, 1)).toBe(start)
  })

  it('неделя, пересекающая границу года', () => {
    // 1 января 2027 — пятница
    expect(startOfWeek(localDate('2027-01-01'), 1)).toBe('2026-12-28')
  })

  it('неделя, пересекающая границу месяца', () => {
    expect(startOfWeek(localDate('2026-09-02'), 1)).toBe('2026-08-31')
  })
})

describe('weekOf', () => {
  it('возвращает начало и конец недели включительно', () => {
    expect(weekOf(localDate('2026-08-11'), 1)).toEqual({ start: '2026-08-10', end: '2026-08-16' })
  })

  it('при неделе с воскресенья границы сдвигаются', () => {
    expect(weekOf(localDate('2026-08-11'), 7)).toEqual({ start: '2026-08-09', end: '2026-08-15' })
  })
})

describe('weeksOfRange', () => {
  it('август 2026 при неделе с понедельника укладывается в шесть недель', () => {
    const weeks = weeksOfRange(localDate('2026-08-01'), localDate('2026-08-31'), 1)
    expect(weeks).toHaveLength(6)
    expect(weeks[0]!.start).toBe('2026-07-27')
    expect(weeks[5]!.start).toBe('2026-08-31')
  })

  it('недели идут по возрастанию без пропусков', () => {
    const weeks = weeksOfRange(localDate('2026-08-01'), localDate('2026-09-30'), 1)
    for (let i = 1; i < weeks.length; i++) {
      expect(daysBetween(weeks[i - 1]!.start, weeks[i]!.start)).toBe(7)
    }
  })

  it('отрезок внутри одной недели даёт одну неделю', () => {
    expect(weeksOfRange(localDate('2026-08-11'), localDate('2026-08-13'), 1)).toHaveLength(1)
  })

  it('отрезок из одного дня даёт одну неделю', () => {
    expect(weeksOfRange(localDate('2026-08-11'), localDate('2026-08-11'), 1)).toHaveLength(1)
  })

  it('перевёрнутый отрезок даёт пустой список, а не бесконечный цикл', () => {
    expect(weeksOfRange(localDate('2026-08-31'), localDate('2026-08-01'), 1)).toEqual([])
  })
})

describe('addDays и daysBetween', () => {
  it('обычный сдвиг вперёд и назад', () => {
    expect(addDays(localDate('2026-08-11'), 3)).toBe('2026-08-14')
    expect(addDays(localDate('2026-08-11'), -3)).toBe('2026-08-08')
    expect(addDays(localDate('2026-08-11'), 0)).toBe('2026-08-11')
  })

  it('переход через границу месяца и года', () => {
    expect(addDays(localDate('2026-08-31'), 1)).toBe('2026-09-01')
    expect(addDays(localDate('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addDays(localDate('2027-01-01'), -1)).toBe('2026-12-31')
  })

  it('високосный год: 29 февраля существует', () => {
    expect(addDays(localDate('2028-02-28'), 1)).toBe('2028-02-29')
    expect(daysBetween(localDate('2028-02-28'), localDate('2028-03-01'))).toBe(2)
  })

  it('невисокосный год: после 28 февраля сразу март', () => {
    expect(addDays(localDate('2027-02-28'), 1)).toBe('2027-03-01')
    expect(daysBetween(localDate('2027-02-28'), localDate('2027-03-01'))).toBe(1)
  })

  it('день перехода на летнее время считается за один день, а не за 23 часа', () => {
    // классическая ошибка реализации через миллисекунды
    expect(addDays(localDate('2026-03-07'), 1)).toBe('2026-03-08')
    expect(daysBetween(localDate('2026-03-07'), localDate('2026-03-09'))).toBe(2)
  })

  it('день возврата на зимнее время тоже считается за один день', () => {
    expect(addDays(localDate('2026-10-31'), 1)).toBe('2026-11-01')
    expect(daysBetween(localDate('2026-10-31'), localDate('2026-11-02'))).toBe(2)
  })

  it('разница отрицательна, если вторая дата раньше первой', () => {
    expect(daysBetween(localDate('2026-08-14'), localDate('2026-08-11'))).toBe(-3)
  })

  it('разница с самой собой равна нулю', () => {
    expect(daysBetween(localDate('2026-08-11'), localDate('2026-08-11'))).toBe(0)
  })
})

describe('isWithin — границы включительно', () => {
  const from = localDate('2026-08-17')
  const to = localDate('2026-08-23')

  it.each([
    ['2026-08-17', true],
    ['2026-08-20', true],
    ['2026-08-23', true],
    ['2026-08-16', false],
    ['2026-08-24', false],
  ])('%s → %s', (date, expected) => {
    expect(isWithin(localDate(date), from, to)).toBe(expected)
  })

  it('отрезок из одного дня', () => {
    expect(isWithin(localDate('2026-08-17'), from, from)).toBe(true)
    expect(isWithin(localDate('2026-08-18'), from, from)).toBe(false)
  })
})
