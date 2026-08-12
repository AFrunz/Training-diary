import { localDate } from '../../model/types'
import type { DateRange } from '../../model/types'
import { computeStreaks } from '../streak'

const d = (s: string) => localDate(s)
const range = (from: string, to: string): DateRange => ({ from: d(from), to: d(to) })

/**
 * Опорные недели (понедельник — воскресенье):
 *   27 июл – 2 авг · 3–9 авг · 10–16 авг · 17–23 авг · 24–30 авг · 31 авг – 6 сен
 */
const base = {
  period: range('2026-07-27', '2026-08-16'),
  absences: [] as DateRange[],
  firstDayOfWeek: 1 as const,
  today: d('2026-08-11'),
}

describe('computeStreaks — базовые случаи', () => {
  it('три недели подряд с тренировками', () => {
    const r = computeStreaks({
      ...base,
      workoutDates: [d('2026-07-28'), d('2026-08-05'), d('2026-08-11')],
    })
    expect(r.current).toBe(3)
    expect(r.record).toBe(3)
  })

  it('несколько тренировок в одной неделе считаются за одну неделю', () => {
    const r = computeStreaks({
      ...base,
      workoutDates: [d('2026-08-10'), d('2026-08-11'), d('2026-08-13'), d('2026-08-15')],
    })
    expect(r.current).toBe(1)
  })

  it('нет тренировок вовсе → нули, а не null', () => {
    expect(computeStreaks({ ...base, workoutDates: [] })).toEqual({ current: 0, record: 0 })
  })

  it('единственная тренировка на этой неделе даёт серию в одну неделю', () => {
    const r = computeStreaks({ ...base, workoutDates: [d('2026-08-11')] })
    expect(r.current).toBe(1)
    expect(r.record).toBe(1)
  })
})

describe('computeStreaks — пропуски', () => {
  it('пропущенная неделя обрывает серию', () => {
    const r = computeStreaks({
      ...base,
      // 27 июл – 2 авг: есть, 3–9 авг: пропуск, 10–16 авг: есть
      workoutDates: [d('2026-07-28'), d('2026-08-11')],
    })
    expect(r.current).toBe(1)
    expect(r.record).toBe(1)
  })

  it('рекорд помнит прошлую длинную серию, даже когда текущая короче', () => {
    const r = computeStreaks({
      period: range('2026-06-01', '2026-08-16'),
      absences: [],
      firstDayOfWeek: 1,
      today: d('2026-08-11'),
      // четыре недели подряд в июне, затем пропуск, затем одна неделя в августе
      workoutDates: [
        d('2026-06-01'), d('2026-06-08'), d('2026-06-15'), d('2026-06-22'),
        d('2026-08-11'),
      ],
    })
    expect(r.record).toBe(4)
    expect(r.current).toBe(1)
  })

  it('текущая неделя ещё не закончилась и пока пустая — серия не рвётся', () => {
    const r = computeStreaks({
      ...base,
      // тренировки в двух прошлых неделях, на текущей ещё ничего
      workoutDates: [d('2026-07-28'), d('2026-08-05')],
      today: d('2026-08-11'),
    })
    expect(r.current).toBe(2)
  })

  it('но полностью пропущенная прошлая неделя серию всё же рвёт', () => {
    const r = computeStreaks({
      ...base,
      workoutDates: [d('2026-07-28')],
      today: d('2026-08-11'),
    })
    expect(r.current).toBe(0)
  })
})

describe('computeStreaks — отсутствие не прерывает серию', () => {
  it('неделя отпуска между двумя рабочими неделями склеивает их', () => {
    const r = computeStreaks({
      period: range('2026-08-03', '2026-08-30'),
      workoutDates: [d('2026-08-11'), d('2026-08-25')],
      absences: [range('2026-08-17', '2026-08-23')],
      firstDayOfWeek: 1,
      today: d('2026-08-27'),
    })
    expect(r.current).toBe(2)
  })

  it('неделя отпуска сама в длину серии не входит', () => {
    const r = computeStreaks({
      period: range('2026-08-03', '2026-08-30'),
      workoutDates: [d('2026-08-11'), d('2026-08-25')],
      absences: [range('2026-08-17', '2026-08-23')],
      firstDayOfWeek: 1,
      today: d('2026-08-27'),
    })
    expect(r.current).not.toBe(3)
  })

  it('отпуск на две недели подряд тоже склеивает', () => {
    const r = computeStreaks({
      period: range('2026-08-03', '2026-09-06'),
      workoutDates: [d('2026-08-11'), d('2026-09-01')],
      absences: [range('2026-08-17', '2026-08-30')],
      firstDayOfWeek: 1,
      today: d('2026-09-03'),
    })
    expect(r.current).toBe(2)
  })

  it('отпуск, покрывающий неделю не целиком, от пропуска не спасает', () => {
    const r = computeStreaks({
      period: range('2026-08-03', '2026-08-30'),
      workoutDates: [d('2026-08-11'), d('2026-08-25')],
      absences: [range('2026-08-18', '2026-08-20')],
      firstDayOfWeek: 1,
      today: d('2026-08-27'),
    })
    expect(r.current).toBe(1)
  })

  it('серия, целиком состоящая из отпуска, равна нулю', () => {
    const r = computeStreaks({
      period: range('2026-08-17', '2026-08-23'),
      workoutDates: [],
      absences: [range('2026-08-17', '2026-08-23')],
      firstDayOfWeek: 1,
      today: d('2026-08-20'),
    })
    expect(r).toEqual({ current: 0, record: 0 })
  })
})
