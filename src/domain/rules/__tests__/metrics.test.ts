import { localDate } from '../../model/types'
import type { DateRange, LocalDate } from '../../model/types'
import {
  averageOrNull,
  countEligibleWeeks,
  epley1RM,
  exerciseVolume,
  workoutsPerWeek,
} from '../metrics'

const d = (s: string) => localDate(s)
const range = (from: string, to: string): DateRange => ({ from: d(from), to: d(to) })
const august = range('2026-08-01', '2026-08-31')

describe('epley1RM', () => {
  it('считает по формуле вес × (1 + повторы / 30)', () => {
    expect(epley1RM(80, 8)!).toBeCloseTo(101.33, 2)
    expect(epley1RM(100, 5)!).toBeCloseTo(116.67, 2)
  })

  it('при одном повторе равен рабочему весу', () => {
    expect(epley1RM(82.5, 1)).toBeCloseTo(82.5, 6)
  })

  it('верхняя граница: 12 повторов считаются, 13 — уже нет', () => {
    expect(epley1RM(60, 12)).not.toBeNull()
    expect(epley1RM(60, 13)).toBeNull()
  })

  it('без веса не считается — упражнения вроде турника', () => {
    expect(epley1RM(null, 8)).toBeNull()
  })

  it('нулевой и отрицательный вес не считаются', () => {
    expect(epley1RM(0, 8)).toBeNull()
    expect(epley1RM(-20, 8)).toBeNull()
  })

  it('нулевые и отрицательные повторы не считаются', () => {
    expect(epley1RM(80, 0)).toBeNull()
    expect(epley1RM(80, -3)).toBeNull()
  })

  it('дробные повторы не считаются', () => {
    expect(epley1RM(80, 8.5)).toBeNull()
  })
})

describe('averageOrNull', () => {
  it('среднее по заполненным значениям', () => {
    expect(averageOrNull([10, 20, 30])).toBe(20)
  })

  it('null пропускаются и не занижают среднее', () => {
    expect(averageOrNull([10, null, 20])).toBe(15)
  })

  it('нет данных вовсе → null, а не 0 (FR-6.4)', () => {
    expect(averageOrNull([])).toBeNull()
    expect(averageOrNull([null, null])).toBeNull()
  })

  it('единственное значение возвращается как есть', () => {
    expect(averageOrNull([42])).toBe(42)
  })

  it('нули — это данные, а не их отсутствие', () => {
    expect(averageOrNull([0, 0, 30])).toBe(10)
  })
})

describe('countEligibleWeeks — недели целиком в отпуске исключаются', () => {
  it('август 2026 без отпуска — шесть недель', () => {
    expect(countEligibleWeeks({ period: august, absences: [], firstDayOfWeek: 1 })).toBe(6)
  })

  it('отпуск 17–23 августа закрывает ровно одну неделю', () => {
    const weeks = countEligibleWeeks({
      period: august,
      absences: [range('2026-08-17', '2026-08-23')],
      firstDayOfWeek: 1,
    })
    expect(weeks).toBe(5)
  })

  it('отпуск, покрывающий неделю не полностью, её не исключает', () => {
    const weeks = countEligibleWeeks({
      period: august,
      absences: [range('2026-08-18', '2026-08-21')],
      firstDayOfWeek: 1,
    })
    expect(weeks).toBe(6)
  })

  it('отпуск на две полные недели исключает обе', () => {
    const weeks = countEligibleWeeks({
      period: august,
      absences: [range('2026-08-10', '2026-08-23')],
      firstDayOfWeek: 1,
    })
    expect(weeks).toBe(4)
  })

  it('та же неделя при воскресном начале уже не покрыта отпуском целиком', () => {
    const weeks = countEligibleWeeks({
      period: august,
      absences: [range('2026-08-17', '2026-08-23')],
      firstDayOfWeek: 7,
    })
    expect(weeks).toBe(6)
  })

  it('пересекающиеся отпуска не вычитаются дважды', () => {
    const weeks = countEligibleWeeks({
      period: august,
      absences: [range('2026-08-17', '2026-08-23'), range('2026-08-19', '2026-08-25')],
      firstDayOfWeek: 1,
    })
    expect(weeks).toBe(5)
  })

  it('отпуск на весь период не оставляет ни одной недели', () => {
    const weeks = countEligibleWeeks({
      period: august,
      absences: [range('2026-07-01', '2026-09-30')],
      firstDayOfWeek: 1,
    })
    expect(weeks).toBe(0)
  })

  it('перевёрнутый период даёт ноль недель', () => {
    const weeks = countEligibleWeeks({
      period: range('2026-08-31', '2026-08-01'),
      absences: [],
      firstDayOfWeek: 1,
    })
    expect(weeks).toBe(0)
  })
})

describe('workoutsPerWeek', () => {
  const dates = (...xs: string[]): LocalDate[] => xs.map(d)

  it('двенадцать тренировок на пять зачётных недель', () => {
    const result = workoutsPerWeek({
      period: august,
      workoutDates: dates(
        '2026-08-03', '2026-08-05', '2026-08-07',
        '2026-08-10', '2026-08-11', '2026-08-13', '2026-08-14',
        '2026-08-24', '2026-08-26', '2026-08-28',
        '2026-08-31', '2026-08-01',
      ),
      absences: [range('2026-08-17', '2026-08-23')],
      firstDayOfWeek: 1,
    })
    expect(result).toBeCloseTo(12 / 5, 5)
  })

  it('тренировки вне периода не учитываются', () => {
    const result = workoutsPerWeek({
      period: range('2026-08-10', '2026-08-16'),
      workoutDates: dates('2026-08-11', '2026-08-13', '2026-08-20'),
      absences: [],
      firstDayOfWeek: 1,
    })
    expect(result).toBe(2)
  })

  it('период целиком в отпуске → null, а не деление на ноль', () => {
    const result = workoutsPerWeek({
      period: range('2026-08-17', '2026-08-23'),
      workoutDates: [],
      absences: [range('2026-08-17', '2026-08-23')],
      firstDayOfWeek: 1,
    })
    expect(result).toBeNull()
  })

  it('ни одной тренировки при живых неделях — это ноль, а не отсутствие данных', () => {
    const result = workoutsPerWeek({
      period: range('2026-08-10', '2026-08-16'),
      workoutDates: [],
      absences: [],
      firstDayOfWeek: 1,
    })
    expect(result).toBe(0)
  })

  it('тренировка в день отпуска всё равно засчитывается: пользователь сходил в зал', () => {
    const result = workoutsPerWeek({
      period: range('2026-08-10', '2026-08-23'),
      workoutDates: dates('2026-08-11', '2026-08-19'),
      absences: [range('2026-08-17', '2026-08-23')],
      firstDayOfWeek: 1,
    })
    expect(result).toBe(2)
  })
})

describe('exerciseVolume — объём упражнения (FR-5.5)', () => {
  it('складывает вес, умноженный на повторы', () => {
    const volume = exerciseVolume([
      { weightKg: 80, reps: 8 },
      { weightKg: 82.5, reps: 6 },
    ])
    expect(volume.weightKg).toBe(80 * 8 + 82.5 * 6)
  })

  it('упражнение без веса считается повторами', () => {
    const volume = exerciseVolume([
      { weightKg: null, reps: 12 },
      { weightKg: null, reps: 10 },
    ])
    expect(volume).toEqual({ weightKg: null, reps: 22 })
  })

  it('нулевой вес — это отсутствие веса, а не нулевой тоннаж', () => {
    expect(exerciseVolume([{ weightKg: 0, reps: 20 }])).toEqual({ weightKg: null, reps: 20 })
  })

  it('смешанное упражнение отдаёт и тоннаж, и повторы подходов без веса', () => {
    const volume = exerciseVolume([
      { weightKg: 20, reps: 10 },
      { weightKg: null, reps: 12 },
    ])
    expect(volume).toEqual({ weightKg: 200, reps: 12 })
  })

  it('без подходов объёма нет', () => {
    expect(exerciseVolume([])).toEqual({ weightKg: null, reps: 0 })
  })
})
